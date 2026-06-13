import { describe, expect, it } from 'vitest';
import { CellState } from '../../src/engine/core/types';
import { commitTrail } from '../../src/engine/systems/claim';
import { makeTestState, layTrail, placeBoss } from './helpers';

/**
 * Question: at commit time, can floor(boss.pos) ever be a TRAIL cell while the
 * boss center is otherwise legitimately positioned? The fallback only fires
 * when the exact center cell is NOT unclaimed after step 1.
 *
 * Here we directly construct the documented "float-edge rounding" case the
 * code comment claims is the only realistic trigger and observe the outcome.
 */
describe('repro: fallback ambiguity', () => {
  it('boss center floors onto a fresh trail cell -> wrong side survives', () => {
    const state = makeTestState();
    // Boss sits just to the LEFT of the trail line x=8, but float rounding puts
    // its center at x just under 8 vs just over. Place center at exactly the
    // trail column so floor lands on the trail cell.
    placeBoss(state, { x: 8, y: 5 }); // center (8.5, 5.5) -> floor (8,5)
    const trail = [];
    for (let y = 1; y <= 10; y++) trail.push({ x: 8, y });
    layTrail(state, trail, { x: 8, y: 0 });
    state.player.pos = { x: 8, y: 11 };

    // The boss is REALLY on the right side conceptually but its floor cell is
    // the trail. After commit, which side stays unclaimed?
    commitTrail(state);
    const left = state.grid.cells; // inspect
    const idx = (x: number, y: number) => y * 16 + x;
    const leftSurv = left[idx(4, 5)] === CellState.Unclaimed;
    const rightSurv = left[idx(12, 5)] === CellState.Unclaimed;
    console.log('fallback case -> LEFT survived:', leftSurv, 'RIGHT survived:', rightSurv);
    expect(leftSurv).toBe(true); // top-left raster bias picks the LEFT side
  });
});
