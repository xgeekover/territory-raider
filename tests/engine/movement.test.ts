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
    updatePlayer(state, input(['left']), 1 / 60);
    expect(state.player.pos).toEqual({ x: 0, y: 0 }); // reached the corner
    // turning down the left wall must make progress, not stick at the corner
    for (let i = 0; i < 3; i++) updatePlayer(state, input(['down']), 1 / 60);
    expect(state.player.pos.x).toBe(0);
    expect(state.player.pos.y).toBeGreaterThanOrEqual(1);
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

  it('averages the configured speed across a second of fixed ticks', () => {
    // Regression: clamping the cooldown to 0 dropped the sub-tick remainder and
    // slowed the player to ~20 c/s. On a wide grid one second of 60Hz ticks
    // must yield ~PLAYER_SPEED steps regardless of the period/dt mismatch.
    const state = makeTestState({ width: 64, height: 12 });
    state.player.pos = { x: 1, y: 0 };
    let steps = 0;
    let prev = state.player.pos.x;
    for (let i = 0; i < 60; i++) {
      updatePlayer(state, input(['right']), 1 / 60);
      steps += state.player.pos.x - prev;
      prev = state.player.pos.x;
    }
    expect(steps).toBeGreaterThanOrEqual(27);
    expect(steps).toBeLessThanOrEqual(29); // 28 cells/sec, not 20
  });

  it('is frame-rate independent (same distance at 30Hz and 60Hz)', () => {
    const run = (hz: number) => {
      const state = makeTestState({ width: 64, height: 12 });
      state.player.pos = { x: 1, y: 0 };
      const ticks = hz; // one second
      for (let i = 0; i < ticks; i++) updatePlayer(state, input(['right']), 1 / hz);
      return state.player.pos.x - 1;
    };
    expect(Math.abs(run(60) - run(30))).toBeLessThanOrEqual(1);
  });

  it('does not bank steps and teleport when a long block reopens', () => {
    const state = makeTestState();
    state.player.pos = { x: 8, y: 0 };
    // 2 seconds pressing down into the unclaimed interior with no action key:
    // every step is rejected, so the cooldown debt must stay bounded.
    for (let i = 0; i < 120; i++) updatePlayer(state, input(['down']), 1 / 60);
    expect(state.player.pos).toEqual({ x: 8, y: 0 });
    // now the path opens (walk right along the border): at most ~2 cells in the
    // first tick, never a field-spanning lurch.
    const before = state.player.pos.x;
    updatePlayer(state, input(['right']), 1 / 60);
    expect(state.player.pos.x - before).toBeLessThanOrEqual(2);
  });
});
