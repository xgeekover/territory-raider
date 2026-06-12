import { describe, expect, it } from 'vitest';
import { CellState } from '../../src/engine/core/types';
import { fireLaser, updateLasers } from '../../src/engine/systems/laser';
import { BOSS_KILL_BONUS, LASER_CHARGES } from '../../src/engine/config/constants';
import { makeTestState, placeBoss } from './helpers';

function armedState() {
  const state = makeTestState();
  state.laserAmmo = LASER_CHARGES;
  state.player.pos = { x: 8, y: 0 };
  state.player.facing = 'down';
  return state;
}

describe('laser firing (spec 2.6)', () => {
  it('fires from shield mode toward the unclaimed side and spends ammo', () => {
    const state = armedState();
    expect(fireLaser(state)).toBe(true);
    expect(state.laserAmmo).toBe(LASER_CHARGES - 1);
    expect(state.lasers).toHaveLength(1);
    expect(state.lasers[0]?.dir).toBe('down');
  });

  it('redirects into open space when the facing direction is blocked', () => {
    const state = armedState();
    state.player.facing = 'up'; // off the field — pick a direction with unclaimed space
    expect(fireLaser(state)).toBe(true);
    expect(state.lasers[0]?.dir).toBe('down');
  });

  it('cannot fire while drawing or without ammo', () => {
    const state = armedState();
    state.player.mode = 'drawing';
    expect(fireLaser(state)).toBe(false);

    state.player.mode = 'shield';
    state.laserAmmo = 0;
    expect(fireLaser(state)).toBe(false);
    expect(state.lasers).toHaveLength(0);
  });
});

describe('laser hits', () => {
  it('kills a wanderer instantly', () => {
    const state = armedState();
    placeBoss(state, { x: 13, y: 9 }); // out of the firing line
    state.minions.push({
      kind: 'wanderer',
      id: 1,
      alive: true,
      pos: { x: 8.5, y: 6.5 },
      vel: { x: 0, y: 0 },
      sparkCooldown: 0,
    });
    fireLaser(state);
    updateLasers(state, 0.2); // 18 cells of travel

    expect(state.minions[0]?.alive).toBe(false);
    expect(state.lasers).toHaveLength(0); // absorbed by the kill
  });

  it('damages the boss by exactly 1 HP per shot', () => {
    const state = armedState();
    placeBoss(state, { x: 8, y: 6 });
    fireLaser(state);
    updateLasers(state, 0.2);

    expect(state.boss.hp).toBe(state.stage.bossHp - 1);
    expect(state.boss.alive).toBe(true);
    expect(state.lasers).toHaveLength(0);
  });

  it('boss kill claims the whole field and clears the stage with the big bonus (test case 6)', () => {
    const state = armedState();
    placeBoss(state, { x: 8, y: 6 });
    state.boss.hp = 1;
    const scoreBefore = state.score;

    fireLaser(state);
    updateLasers(state, 0.2);

    expect(state.boss.alive).toBe(false);
    expect(state.bossKillClear).toBe(true);
    expect(state.claimRatio).toBe(1);
    expect(state.status).toBe('stageClear');
    for (let y = 1; y <= 10; y++) {
      for (let x = 1; x <= 14; x++) {
        expect(state.grid.cells[y * state.grid.width + x]).toBe(CellState.Claimed);
      }
    }
    // boss-kill bonus + full-claim over-80% bonus (20 points over * 1,000)
    expect(state.score - scoreBefore).toBe(BOSS_KILL_BONUS + 20 * 1000);
  });

  it('dissipates against claimed cells', () => {
    const state = armedState();
    placeBoss(state, { x: 12, y: 9 });
    // claimed wall across the firing line
    for (let x = 1; x <= 14; x++) state.grid.cells[5 * state.grid.width + x] = CellState.Claimed;
    fireLaser(state);
    updateLasers(state, 1);

    expect(state.lasers).toHaveLength(0);
    expect(state.boss.hp).toBe(state.stage.bossHp); // never reached
  });
});
