import { describe, expect, it } from 'vitest';
import type { Vec2 } from '../../src/engine/core/types';
import { cellIndex } from '../../src/engine/core/grid';
import { spawnSparksFromContacts, updateSparks } from '../../src/engine/systems/spark';
import { SPARK_SPAWN_COOLDOWN } from '../../src/engine/config/constants';
import { layTrail, makeTestState } from './helpers';

function stateWithTrail() {
  const state = makeTestState();
  // straight 8-cell trail down from the top border; player rides (8,8)
  const trail: Vec2[] = [];
  for (let y = 1; y <= 8; y++) trail.push({ x: 8, y });
  layTrail(state, trail, { x: 8, y: 0 });
  return state;
}

describe('sparks (spec 2.4)', () => {
  it('spawns at the contacted trail cell with the matching array index', () => {
    const state = stateWithTrail();
    const source = { sparkCooldown: 0 };
    const contactCell = cellIndex(state.grid, 8, 4); // trail array index 3

    spawnSparksFromContacts(state, [{ cellIdx: contactCell, source }]);

    expect(state.sparks).toHaveLength(1);
    expect(state.sparks[0]?.trailIndex).toBe(3);
    expect(source.sparkCooldown).toBe(SPARK_SPAWN_COOLDOWN);
  });

  it('respects the per-enemy spawn cooldown', () => {
    const state = stateWithTrail();
    const source = { sparkCooldown: 0 };
    const contactCell = cellIndex(state.grid, 8, 4);

    spawnSparksFromContacts(state, [
      { cellIdx: contactCell, source },
      { cellIdx: cellIndex(state.grid, 8, 5), source },
    ]);
    expect(state.sparks).toHaveLength(1);
  });

  it('advances along trail indices toward the player at sparkSpeed', () => {
    const state = stateWithTrail(); // sparkSpeed 10 in TEST_STAGE
    state.sparks.push({ trailIndex: 0 });

    updateSparks(state, 0.2); // 10 cells/s * 0.2s = 2 indices
    expect(state.sparks[0]?.trailIndex).toBeCloseTo(2);
    expect(state.playerHit).toBe(false);

    updateSparks(state, 0.2);
    expect(state.sparks[0]?.trailIndex).toBeCloseTo(4);
  });

  it('kills the player when it reaches the trail head (player cell)', () => {
    const state = stateWithTrail();
    state.sparks.push({ trailIndex: 6 });

    updateSparks(state, 0.2); // 6 + 2 >= head index 7
    expect(state.playerHit).toBe(true);
  });

  it('keeps chasing when the trail grows under it', () => {
    const state = stateWithTrail();
    state.sparks.push({ trailIndex: 6.5 });
    // the player draws one more cell before the spark arrives
    state.trail.cells.push({ x: 8, y: 9 });
    state.player.pos = { x: 8, y: 9 };

    updateSparks(state, 0.1); // 6.5 + 1 = 7.5 < new head 8
    expect(state.playerHit).toBe(false);
    updateSparks(state, 0.1);
    expect(state.playerHit).toBe(true);
  });
});
