import { describe, expect, it } from 'vitest';
import { CellState } from '../../src/engine/core/types';
import type { InputState } from '../../src/engine/core/types';
import { tryStep, updatePlayer } from '../../src/engine/systems/movement';
import { cellAt, makeTestState, placeBoss } from './helpers';

const input = (dirs: InputState['dirs'], action = false): InputState => ({ dirs, action });

describe('trail rules (spec 2.2)', () => {
  it('holding action and stepping into unclaimed space starts drawing', () => {
    const state = makeTestState();
    state.player.pos = { x: 8, y: 0 };
    expect(tryStep(state, input(['down'], true))).toBe(true);

    expect(state.player.mode).toBe('drawing');
    expect(state.player.pos).toEqual({ x: 8, y: 1 });
    expect(cellAt(state, 8, 1)).toBe(CellState.Trail);
    expect(state.trail.cells).toEqual([{ x: 8, y: 1 }]);
    expect(state.trail.startCell).toEqual({ x: 8, y: 0 });
  });

  it('blocks backtracking to the previous cell', () => {
    const state = makeTestState();
    state.player.pos = { x: 8, y: 0 };
    tryStep(state, input(['down'], true)); // (8,1) — trail length 1

    // back up onto the start cell: forbidden
    expect(tryStep(state, input(['up'], true))).toBe(false);
    expect(state.player.pos).toEqual({ x: 8, y: 1 });
    expect(state.player.mode).toBe('drawing');

    tryStep(state, input(['down'], true)); // (8,2)
    // previous cell is TRAIL now — still forbidden
    expect(tryStep(state, input(['up'], true))).toBe(false);
    expect(state.player.pos).toEqual({ x: 8, y: 2 });
  });

  it('blocks self-crossing into any trail cell', () => {
    const state = makeTestState();
    state.player.pos = { x: 8, y: 0 };
    // draw a hook: down, down, right, up — then try to step left into (8,1)
    tryStep(state, input(['down'], true));
    tryStep(state, input(['down'], true));
    tryStep(state, input(['right'], true));
    tryStep(state, input(['up'], true));
    expect(state.player.pos).toEqual({ x: 9, y: 1 });

    expect(tryStep(state, input(['left'], true))).toBe(false);
    expect(state.player.pos).toEqual({ x: 9, y: 1 });
    expect(state.player.mode).toBe('drawing');
  });

  it('standing still while drawing is allowed (Volfied, unlike Qix)', () => {
    const state = makeTestState();
    state.player.pos = { x: 8, y: 0 };
    tryStep(state, input(['down'], true));
    updatePlayer(state, input([], true), 0.5); // half a second of no input
    expect(state.player.mode).toBe('drawing');
    expect(state.trail.cells).toHaveLength(1);
  });

  it('does not extend the trail into unclaimed space without the action key', () => {
    const state = makeTestState();
    state.player.pos = { x: 8, y: 0 };
    tryStep(state, input(['down'], true));
    expect(tryStep(state, input(['down'], false))).toBe(false);
    expect(state.trail.cells).toHaveLength(1);
  });

  it('converts TRAIL to CLAIMED when the trail commits onto a claimed cell', () => {
    const state = makeTestState();
    placeBoss(state, { x: 12, y: 6 });
    state.player.pos = { x: 8, y: 0 };
    tryStep(state, input(['down'], true));
    tryStep(state, input(['down'], true));
    tryStep(state, input(['right'], true));
    expect(tryStep(state, input(['up'], true))).toBe(true); // (9,1)
    expect(tryStep(state, input(['up'], true))).toBe(true); // (9,0): border -> commit

    expect(state.player.mode).toBe('shield');
    expect(state.player.pos).toEqual({ x: 9, y: 0 });
    expect(state.trail.cells).toHaveLength(0);
    expect(state.trail.set.size).toBe(0);
    expect(cellAt(state, 8, 1)).toBe(CellState.Claimed);
    expect(cellAt(state, 8, 2)).toBe(CellState.Claimed);
    expect(cellAt(state, 9, 2)).toBe(CellState.Claimed);
    expect(cellAt(state, 9, 1)).toBe(CellState.Claimed);
    // 4 cells < 15% of interior -> plain x10 score
    expect(state.score).toBe(40);
    expect(state.gridVersion).toBe(1);
  });
});
