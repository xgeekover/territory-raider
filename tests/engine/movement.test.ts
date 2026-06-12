import { describe, expect, it } from 'vitest';
import { updatePlayer } from '../../src/engine/systems/movement';
import type { InputState } from '../../src/engine/core/types';
import { makeTestState } from './helpers';

const input = (dirs: InputState['dirs'], action = false): InputState => ({ dirs, action });

describe('shield movement (spec 2.2)', () => {
  it('walks along the border ring', () => {
    const state = makeTestState();
    state.player.pos = { x: 8, y: 0 };
    updatePlayer(state, input(['right']), 1 / 10); // enough time for >1 step
    expect(state.player.pos.x).toBeGreaterThan(8);
    expect(state.player.pos.y).toBe(0);
  });

  it('cannot enter the unclaimed interior without the action key', () => {
    const state = makeTestState();
    state.player.pos = { x: 8, y: 0 };
    updatePlayer(state, input(['down']), 1 / 10);
    expect(state.player.pos).toEqual({ x: 8, y: 0 });
    expect(state.player.mode).toBe('shield');
  });

  it('can turn a ring corner (8-neighbor walkability)', () => {
    const state = makeTestState();
    state.player.pos = { x: 1, y: 0 };
    updatePlayer(state, input(['left']), 1 / 20);
    expect(state.player.pos).toEqual({ x: 0, y: 0 });
    updatePlayer(state, input(['down']), 1 / 20);
    expect(state.player.pos).toEqual({ x: 0, y: 1 });
  });

  it('steps at the configured speed (one cell per 1/speed seconds)', () => {
    const state = makeTestState();
    state.player.pos = { x: 8, y: 0 };
    updatePlayer(state, input(['right']), 1 / 60);
    const afterOneTick = state.player.pos.x;
    expect(afterOneTick).toBe(9); // first step is immediate
    updatePlayer(state, input(['right']), 1 / 60);
    updatePlayer(state, input(['right']), 1 / 60);
    // 28 cells/sec => ~0.0357s per step; 2 more ticks (~0.033s) < 1 step
    expect(state.player.pos.x).toBeLessThanOrEqual(afterOneTick + 1);
  });

  it('prefers the most recently pressed direction', () => {
    const state = makeTestState();
    state.player.pos = { x: 8, y: 0 };
    updatePlayer(state, input(['left', 'right']), 1 / 60);
    expect(state.player.pos.x).toBe(7); // 'left' is first (most recent)
  });
});
