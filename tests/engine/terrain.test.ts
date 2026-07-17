import { describe, expect, it } from 'vitest';
import { CellState } from '../../src/engine/core/types';
import type { InputState } from '../../src/engine/core/types';
import { cellIndex, claimRatio } from '../../src/engine/core/grid';
import { createStageState } from '../../src/engine/core/gameState';
import { createEngine } from '../../src/engine';
import { playerStepPeriod, tryStep, updatePlayer } from '../../src/engine/systems/movement';
import { bounceMove } from '../../src/engine/systems/enemies';
import { updateBossAttack } from '../../src/engine/systems/bossAttack';
import { getStage, themeOf } from '../../src/engine/config/stages';
import {
  FIELD_FEATURE_MARGIN,
  HAZARD_SLOW_DURATION,
  HAZARD_SLOW_FACTOR,
  HAZARD_STUN_DURATION,
  PLAYER_SPEED,
  START_LIVES,
} from '../../src/engine/config/constants';
import { cellAt, makeTestState, TEST_BOSS_STAGE, TEST_STAGE } from './helpers';

const input = (dirs: InputState['dirs'], action = false): InputState => ({ dirs, action });

describe('theme rotation (spec: themed block every 10 stages)', () => {
  it('keeps the first block neutral, then cycles fire → ice → lightning', () => {
    for (let i = 0; i < 10; i++) expect(themeOf(i)).toBeUndefined();
    for (let i = 10; i < 20; i++) expect(themeOf(i)).toBe('fire');
    for (let i = 20; i < 30; i++) expect(themeOf(i)).toBe('ice');
    for (let i = 30; i < 40; i++) expect(themeOf(i)).toBe('lightning');
    for (let i = 40; i < 50; i++) expect(themeOf(i)).toBe('fire'); // cycle repeats
  });

  it('stage configs carry theme + hazard patches only on themed stages', () => {
    expect(getStage(0).theme).toBeUndefined();
    expect(getStage(0).hazardPatches).toBeUndefined();
    expect(getStage(0).obstacleClusters).toBe(0); // stage 1 is an open field
    const themed = getStage(12);
    expect(themed.theme).toBe('fire');
    expect(themed.hazardPatches).toBeGreaterThan(0);
    expect(getStage(5).obstacleClusters).toBeGreaterThan(0);
    for (let i = 0; i < 60; i++) {
      expect(getStage(i).obstacleClusters).toBeLessThanOrEqual(4);
      expect(getStage(i).hazardPatches ?? 0).toBeLessThanOrEqual(4);
    }
  });
});

describe('obstacle placement (real-size grid)', () => {
  const state = createStageState({ seed: 7, stageIndex: 11 }); // themed + rocky

  it('places rocks away from the border ring and the boss spawn center', () => {
    const { grid } = state;
    let obstacleCells = 0;
    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        if (cellAt(state, x, y) !== CellState.Obstacle) continue;
        obstacleCells++;
        expect(x).toBeGreaterThanOrEqual(FIELD_FEATURE_MARGIN);
        expect(y).toBeGreaterThanOrEqual(FIELD_FEATURE_MARGIN);
        expect(x).toBeLessThan(grid.width - FIELD_FEATURE_MARGIN);
        expect(y).toBeLessThan(grid.height - FIELD_FEATURE_MARGIN);
      }
    }
    expect(obstacleCells).toBeGreaterThan(0);
    // rocks leave the claimable pool so 80% stays reachable
    expect(grid.interiorCells).toBe((grid.width - 2) * (grid.height - 2) - obstacleCells);
  });

  it('keeps hazards on unclaimed cells, off rocks and items', () => {
    expect(state.stage.theme).toBe('fire');
    expect(state.hazards.size).toBeGreaterThan(0);
    for (const idx of state.hazards) {
      expect(state.grid.cells[idx]).toBe(CellState.Unclaimed);
    }
    for (const item of state.items) {
      expect(state.hazards.has(cellIndex(state.grid, item.cell.x, item.cell.y))).toBe(false);
    }
  });

  it('never spawns a wanderer inside a rock', () => {
    for (const m of state.minions) {
      if (m.kind !== 'wanderer') continue;
      expect(cellAt(state, Math.floor(m.pos.x), Math.floor(m.pos.y))).toBe(CellState.Unclaimed);
    }
  });
});

describe('obstacles in play', () => {
  it('blocks the drawing cut like a wall (no commit, no move)', () => {
    const state = makeTestState();
    state.player.pos = { x: 8, y: 0 };
    tryStep(state, input(['down'], true)); // drawing at (8,1)
    state.grid.cells[cellIndex(state.grid, 8, 2)] = CellState.Obstacle;

    const moved = tryStep(state, input(['down'], true));
    expect(moved).toBe(false);
    expect(state.player.pos).toEqual({ x: 8, y: 1 });
    expect(state.player.mode).toBe('drawing'); // no accidental commit

    expect(tryStep(state, input(['right'], true))).toBe(true); // detour works
  });

  it('bounces enemies like a solid wall', () => {
    const state = makeTestState();
    for (let y = 1; y <= 10; y++) state.grid.cells[cellIndex(state.grid, 10, y)] = CellState.Obstacle;
    const pos = { x: 9.5, y: 5.5 };
    const vel = { x: 12, y: 0 };
    bounceMove(state.grid, pos, vel, 0.2);
    expect(vel.x).toBeLessThan(0);
    expect(pos.x).toBeLessThan(10);
  });

  it('splashes boss projectiles (rocks are cover)', () => {
    const state = makeTestState({ stages: [TEST_BOSS_STAGE] });
    state.grid.cells[cellIndex(state.grid, 6, 5)] = CellState.Obstacle;
    state.projectiles.push({ id: 1, pos: { x: 5.6, y: 5.5 }, vel: { x: 10, y: 0 } });
    updateBossAttack(state, 0.05); // flies into the rock cell
    expect(state.projectiles).toHaveLength(0);
  });

  it('survives being enclosed by a claim, without counting as claimed', () => {
    const state = makeTestState();
    state.grid.cells[cellIndex(state.grid, 3, 2)] = CellState.Obstacle;
    state.grid.interiorCells -= 1;
    state.boss.pos = { x: 12, y: 8 }; // boss far right — left side gets claimed
    state.player.pos = { x: 6, y: 0 };
    tryStep(state, input(['down'], true));
    for (let i = 0; i < 10; i++) tryStep(state, input(['down'], true)); // cut to the bottom
    expect(state.player.mode).toBe('shield'); // committed on the bottom border

    expect(cellAt(state, 3, 2)).toBe(CellState.Obstacle); // rock endures
    expect(cellAt(state, 2, 2)).toBe(CellState.Claimed); // area around it claimed
    expect(claimRatio(state.grid)).toBe(state.claimRatio);
  });
});

describe('elemental hazards', () => {
  function drawingStateWithHazard(theme: 'fire' | 'ice' | 'lightning') {
    const state = makeTestState({ stages: [{ ...TEST_STAGE, theme, hazardPatches: 0 }] });
    state.player.pos = { x: 8, y: 0 };
    tryStep(state, input(['down'], true)); // drawing at (8,1)
    state.hazards.add(cellIndex(state.grid, 8, 2)); // hazard dead ahead
    return state;
  }

  it('fire burns the whole cut: trail reverts, player returns, no life lost', () => {
    const state = drawingStateWithHazard('fire');
    tryStep(state, input(['down'], true)); // step onto the flames

    expect(state.player.pos).toEqual({ x: 8, y: 0 }); // back where the cut began
    expect(state.player.mode).toBe('shield');
    expect(cellAt(state, 8, 1)).toBe(CellState.Unclaimed);
    expect(cellAt(state, 8, 2)).toBe(CellState.Unclaimed);
    expect(state.lives).toBe(START_LIVES);
    expect(state.trail.cells).toHaveLength(0);
  });

  it('fire ignores grace — a flame patch can never be drawn through', () => {
    const state = drawingStateWithHazard('fire');
    tryStep(state, input(['down'], true)); // burn #1 → back on the border
    // redraw straight back toward the same flame cell, immediately
    tryStep(state, input(['down'], true)); // drawing at (8,1) again
    tryStep(state, input(['down'], true)); // onto the flames again → burn #2

    expect(state.player.pos).toEqual({ x: 8, y: 0 }); // yanked back again
    expect(state.player.mode).toBe('shield');
    expect(state.lives).toBe(START_LIVES); // still free of charge
  });

  it('ice slows movement to half speed for a few seconds', () => {
    const state = drawingStateWithHazard('ice');
    tryStep(state, input(['down'], true)); // step onto the frost

    expect(state.player.slowedFor).toBe(HAZARD_SLOW_DURATION);
    expect(state.player.mode).toBe('drawing'); // the cut survives
    expect(playerStepPeriod(state.player)).toBeCloseTo(1 / (PLAYER_SPEED * HAZARD_SLOW_FACTOR));

    // behavioral: half the steps over the same time vs an unslowed player
    const slowed = state;
    const normal = makeTestState();
    normal.player.pos = { x: 8, y: 0 };
    tryStep(normal, input(['down'], true));
    const slowedFrom = slowed.player.pos.y;
    const normalFrom = normal.player.pos.y;
    for (let i = 0; i < 12; i++) {
      updatePlayer(slowed, input(['down'], true), 1 / 60);
      updatePlayer(normal, input(['down'], true), 1 / 60);
    }
    const slowedSteps = slowed.player.pos.y - slowedFrom;
    const normalSteps = normal.player.pos.y - normalFrom;
    expect(slowedSteps).toBeLessThan(normalSteps);
  });

  it('lightning stuns: no movement at all until the stun expires', () => {
    const state = drawingStateWithHazard('lightning');
    tryStep(state, input(['down'], true)); // step onto the storm

    expect(state.player.stunnedFor).toBe(HAZARD_STUN_DURATION);
    const before = { ...state.player.pos };
    for (let i = 0; i < 30; i++) updatePlayer(state, input(['down'], true), 1 / 60);
    expect(state.player.pos).toEqual(before); // frozen solid

    state.player.stunnedFor = 0;
    for (let i = 0; i < 6; i++) updatePlayer(state, input(['down'], true), 1 / 60);
    expect(state.player.pos.y).toBeGreaterThan(before.y); // free again
  });

  it('grace period stops a patch from chain-triggering', () => {
    const state = drawingStateWithHazard('lightning');
    state.hazards.add(cellIndex(state.grid, 8, 3)); // second hazard right after
    tryStep(state, input(['down'], true)); // trigger #1
    state.player.stunnedFor = 0; // recovered, but still within grace

    tryStep(state, input(['down'], true)); // onto the second hazard cell
    expect(state.player.stunnedFor).toBe(0); // no re-trigger
  });

  it('claiming over a hazard patch cleanses it', () => {
    const state = makeTestState({ stages: [{ ...TEST_STAGE, theme: 'ice', hazardPatches: 0 }] });
    const hazardIdx = cellIndex(state.grid, 2, 2);
    state.hazards.add(hazardIdx);
    state.boss.pos = { x: 12, y: 8 }; // hazard side gets enclosed
    state.player.pos = { x: 6, y: 0 };
    tryStep(state, input(['down'], true));
    for (let i = 0; i < 10; i++) tryStep(state, input(['down'], true));
    expect(state.player.mode).toBe('shield'); // committed

    expect(cellAt(state, 2, 2)).toBe(CellState.Claimed);
    expect(state.hazards.has(hazardIdx)).toBe(false);
  });

  it('ticks hazard timers down and reports them in the HUD snapshot', () => {
    const engine = createEngine({ width: 16, height: 12, seed: 1, stages: [TEST_STAGE] });
    engine.dispatch({ type: 'confirm' });
    const state = engine.getState();
    state.player.slowedFor = 0.55;
    state.player.stunnedFor = 0.15;
    state.player.hazardGraceFor = 1;
    engine.tick({ dirs: [], action: false }, 1 / 60);

    expect(state.player.slowedFor).toBeCloseTo(0.55 - 1 / 60, 5);
    expect(state.player.stunnedFor).toBeCloseTo(0.15 - 1 / 60, 5);
    expect(state.player.hazardGraceFor).toBeCloseTo(1 - 1 / 60, 5);
    expect(engine.getSnapshot().slowedFor).toBeGreaterThan(0);
    expect(engine.getSnapshot().stunnedFor).toBeGreaterThan(0);
  });
});
