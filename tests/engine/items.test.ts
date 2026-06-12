import { describe, expect, it } from 'vitest';
import type { Vec2 } from '../../src/engine/core/types';
import { applyItemEffect } from '../../src/engine/systems/items';
import { commitTrail } from '../../src/engine/systems/claim';
import {
  ITEM_POINTS,
  LASER_CHARGES,
  SPEED_BOOST_MULT,
  TIME_STOP_DURATION,
} from '../../src/engine/config/constants';
import { layTrail, makeTestState, placeBoss } from './helpers';

describe('item effects (spec 2.6)', () => {
  it('T freezes all enemies for the configured duration', () => {
    const state = makeTestState();
    applyItemEffect(state, 'T');
    expect(state.timeStopFor).toBe(TIME_STOP_DURATION);
  });

  it('S boosts player speed for the stage', () => {
    const state = makeTestState();
    applyItemEffect(state, 'S');
    expect(state.player.speedMultiplier).toBe(SPEED_BOOST_MULT);
  });

  it('L charges the laser', () => {
    const state = makeTestState();
    applyItemEffect(state, 'L');
    applyItemEffect(state, 'L');
    expect(state.laserAmmo).toBe(LASER_CHARGES * 2);
  });

  it('P awards points', () => {
    const state = makeTestState();
    applyItemEffect(state, 'P');
    expect(state.score).toBe(ITEM_POINTS);
  });

  it('C destroys every minion on screen', () => {
    const state = makeTestState();
    state.minions.push(
      { kind: 'wanderer', id: 1, alive: true, pos: { x: 5, y: 5 }, vel: { x: 1, y: 0 }, sparkCooldown: 0 },
      { kind: 'edgeCrawler', id: 2, alive: true, cell: { x: 5, y: 0 }, dir: 'left', turn: 1, stepCooldown: 0 },
    );
    applyItemEffect(state, 'C');
    expect(state.minions.every((m) => !m.alive)).toBe(true);
  });
});

describe('item acquisition through claims (spec 2.6 / test case 7)', () => {
  function enclosingTrail(): Vec2[] {
    // vertical split at x=8: left side will be claimed (boss on the right)
    const trail: Vec2[] = [];
    for (let y = 1; y <= 10; y++) trail.push({ x: 8, y });
    return trail;
  }

  it('acquires an item exactly once, the moment its tile is claimed', () => {
    const state = makeTestState();
    placeBoss(state, { x: 12, y: 5 });
    state.items.push({ code: 'L', cell: { x: 4, y: 5 }, collected: false }); // left side
    state.items.push({ code: 'P', cell: { x: 12, y: 8 }, collected: false }); // boss side

    layTrail(state, enclosingTrail(), { x: 8, y: 0 });
    state.player.pos = { x: 8, y: 11 };
    const outcome = commitTrail(state);

    expect(outcome.collectedItems).toEqual(['L']);
    expect(state.laserAmmo).toBe(LASER_CHARGES);
    expect(state.items[0]?.collected).toBe(true);
    expect(state.items[1]?.collected).toBe(false); // unclaimed side untouched

    // a second closure must not re-trigger the first item
    const trail2: Vec2[] = [];
    for (let y = 1; y <= 10; y++) trail2.push({ x: 10, y });
    layTrail(state, trail2, { x: 10, y: 0 });
    placeBoss(state, { x: 13, y: 5 });
    state.player.pos = { x: 10, y: 11 };
    commitTrail(state);

    expect(state.laserAmmo).toBe(LASER_CHARGES); // unchanged — no double pickup
  });

  it('trap bonus: minions enclosed by the claim die and pay 1,000 each', () => {
    const state = makeTestState();
    placeBoss(state, { x: 12, y: 5 });
    state.minions.push(
      { kind: 'wanderer', id: 1, alive: true, pos: { x: 4.5, y: 5.5 }, vel: { x: 1, y: 0 }, sparkCooldown: 0 },
      { kind: 'wanderer', id: 2, alive: true, pos: { x: 12.5, y: 5.5 }, vel: { x: 1, y: 0 }, sparkCooldown: 0 },
    );

    layTrail(state, enclosingTrail(), { x: 8, y: 0 });
    state.player.pos = { x: 8, y: 11 };
    const scoreBefore = state.score;
    const outcome = commitTrail(state);

    expect(outcome.trappedMinions).toBe(1);
    expect(state.minions[0]?.alive).toBe(false); // trapped on the claimed side
    expect(state.minions[1]?.alive).toBe(true); // boss side survives
    // score delta = closure score (80 cells * 10 * 2) + 1,000 trap bonus
    expect(state.score - scoreBefore).toBe(1600 + 1000);
  });
});
