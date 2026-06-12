import { describe, expect, it } from 'vitest';
import { CellState } from '../../src/engine/core/types';
import type { Vec2 } from '../../src/engine/core/types';
import { commitTrail } from '../../src/engine/systems/claim';
import { cellAt, layTrail, makeTestState, placeBoss } from './helpers';

/**
 * Fixture: 16x12 grid (interior 14x10 = 140 cells). A straight vertical trail
 * at x=8 from the top border to the bottom border splits the interior into a
 * left region (x 1..7, 70 cells) and a right region (x 9..14, 60 cells).
 */
function verticalSplit(bossCell: Vec2) {
  const state = makeTestState();
  placeBoss(state, bossCell);
  const trail: Vec2[] = [];
  for (let y = 1; y <= 10; y++) trail.push({ x: 8, y });
  layTrail(state, trail, { x: 8, y: 0 });
  state.player.pos = { x: 8, y: 11 }; // landed on the bottom border -> commit
  return state;
}

describe('commitTrail — flood fill claim (spec 2.3)', () => {
  it('claims only the side the boss is NOT in (boss in the larger side)', () => {
    const state = verticalSplit({ x: 12, y: 5 });
    const outcome = commitTrail(state);

    expect(cellAt(state, 4, 5)).toBe(CellState.Claimed); // left region
    expect(cellAt(state, 8, 5)).toBe(CellState.Claimed); // the trail itself
    expect(cellAt(state, 12, 5)).toBe(CellState.Unclaimed); // boss region survives
    expect(cellAt(state, 9, 1)).toBe(CellState.Unclaimed);
    expect(outcome.claimedCells).toBe(70 + 10);
    expect(state.claimRatio).toBeCloseTo(80 / 140);
  });

  it('claims only the side the boss is NOT in (boss in the smaller side)', () => {
    const state = verticalSplit({ x: 3, y: 5 });
    const outcome = commitTrail(state);

    expect(cellAt(state, 3, 5)).toBe(CellState.Unclaimed); // boss region survives
    expect(cellAt(state, 12, 5)).toBe(CellState.Claimed); // right region claimed
    expect(cellAt(state, 8, 5)).toBe(CellState.Claimed);
    expect(outcome.claimedCells).toBe(60 + 10);
    expect(state.claimRatio).toBeCloseTo(70 / 140);
  });

  it('claims 1-cell sliver gaps without any special-case code', () => {
    const state = makeTestState();
    placeBoss(state, { x: 12, y: 5 });
    // U-shaped trail: down x=4, across y=9, up x=6 — encloses the 1-wide
    // column x=5, y 1..8 against the top border.
    const trail: Vec2[] = [];
    for (let y = 1; y <= 9; y++) trail.push({ x: 4, y });
    trail.push({ x: 5, y: 9 });
    trail.push({ x: 6, y: 9 });
    for (let y = 8; y >= 1; y--) trail.push({ x: 6, y });
    layTrail(state, trail, { x: 4, y: 0 });
    state.player.pos = { x: 6, y: 0 };

    const outcome = commitTrail(state);

    for (let y = 1; y <= 8; y++) {
      expect(cellAt(state, 5, y)).toBe(CellState.Claimed); // the sliver
    }
    expect(cellAt(state, 2, 5)).toBe(CellState.Unclaimed); // left side reaches the boss via row 10
    expect(cellAt(state, 5, 10)).toBe(CellState.Unclaimed);
    expect(cellAt(state, 12, 5)).toBe(CellState.Unclaimed);
    expect(outcome.claimedCells).toBe(19 + 8); // trail + sliver
  });

  it('claims the entire field when the boss is already dead (spec 2.3 note)', () => {
    const state = makeTestState();
    state.boss.alive = false;
    state.boss.hp = 0;
    layTrail(state, [{ x: 8, y: 1 }], { x: 8, y: 0 });
    state.player.pos = { x: 8, y: 0 };

    const outcome = commitTrail(state);

    expect(state.claimRatio).toBe(1);
    expect(outcome.stageCleared).toBe(true);
    expect(state.status).toBe('stageClear');
    for (let y = 1; y <= 10; y++) {
      for (let x = 1; x <= 14; x++) {
        expect(cellAt(state, x, y)).toBe(CellState.Claimed);
      }
    }
  });

  it('clears all sparks on commit (spec 2.3 step 7)', () => {
    const state = verticalSplit({ x: 12, y: 5 });
    state.sparks.push({ trailIndex: 0 });
    commitTrail(state);
    expect(state.sparks).toHaveLength(0);
  });

  it('scores cells x10 and doubles a >=15%-of-interior closure (spec 2.7)', () => {
    const state = verticalSplit({ x: 12, y: 5 });
    commitTrail(state);
    // 80 cells >= 21 (15% of 140) -> 80 * 10 * 2
    expect(state.score).toBe(1600);
  });

  it('awards the over-80% bonus and flips to stageClear (spec 2.7)', () => {
    const state = makeTestState();
    placeBoss(state, { x: 2, y: 1 });
    // L-shaped trail boxing the boss into the top-left 2x1 corner:
    // everything else gets claimed.
    const trail: Vec2[] = [
      { x: 1, y: 2 },
      { x: 2, y: 2 },
      { x: 3, y: 2 },
      { x: 3, y: 1 },
    ];
    layTrail(state, trail, { x: 0, y: 2 });
    state.player.pos = { x: 3, y: 0 };

    const outcome = commitTrail(state);

    expect(outcome.stageCleared).toBe(true);
    expect(state.status).toBe('stageClear');
    // 138/140 claimed = 98.571..% -> bonus per point over 80
    expect(state.claimRatio).toBeCloseTo(138 / 140);
    const overPercent = (138 / 140) * 100 - 80;
    expect(state.lastClearBonus).toBe(Math.round(overPercent * 1000));
  });
});

describe('claim ratio bookkeeping', () => {
  it('uses interior cells (BORDER excluded) as the denominator (spec 2.1)', () => {
    const state = verticalSplit({ x: 12, y: 5 });
    commitTrail(state);
    // 80 claimed interior cells of 140; border ring (52 cells) excluded
    expect(state.claimRatio).toBeCloseTo(80 / 140);
  });
});
