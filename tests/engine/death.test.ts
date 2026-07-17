import { describe, expect, it } from 'vitest';
import { CellState } from '../../src/engine/core/types';
import type { InputState } from '../../src/engine/core/types';
import { claimRatio } from '../../src/engine/core/grid';
import { tryStep } from '../../src/engine/systems/movement';
import { applyDeath, updatePlayerCollisions } from '../../src/engine/systems/collision';
import { RESPAWN_INVINCIBILITY, START_LIVES } from '../../src/engine/config/constants';
import { cellAt, makeTestState } from './helpers';

const input = (dirs: InputState['dirs'], action = false): InputState => ({ dirs, action });

function drawThreeCells(state: ReturnType<typeof makeTestState>) {
  state.player.pos = { x: 8, y: 0 };
  tryStep(state, input(['down'], true));
  tryStep(state, input(['down'], true));
  tryStep(state, input(['right'], true));
}

describe('death and rollback (spec 2.5)', () => {
  it('rolls the whole trail back to UNCLAIMED without touching the ratio', () => {
    const state = makeTestState();
    const ratioBefore = claimRatio(state.grid);
    drawThreeCells(state);
    state.sparks.push({ trailIndex: 0 });

    applyDeath(state);

    expect(cellAt(state, 8, 1)).toBe(CellState.Unclaimed);
    expect(cellAt(state, 8, 2)).toBe(CellState.Unclaimed);
    expect(cellAt(state, 9, 2)).toBe(CellState.Unclaimed);
    expect(claimRatio(state.grid)).toBe(ratioBefore);
    expect(state.claimRatio).toBe(ratioBefore);
    expect(state.sparks).toHaveLength(0);
    expect(state.trail.cells).toHaveLength(0);
    expect(state.trail.set.size).toBe(0);
  });

  it('respawns at the trail start cell with invincibility and one life less', () => {
    const state = makeTestState();
    drawThreeCells(state);

    applyDeath(state);

    expect(state.player.pos).toEqual({ x: 8, y: 0 }); // last safe cell
    expect(state.player.mode).toBe('shield');
    expect(state.player.invincibleFor).toBe(RESPAWN_INVINCIBILITY);
    expect(state.lives).toBe(START_LIVES - 1);
    expect(state.status).toBe('playing');
  });

  it('ends the game at zero lives', () => {
    const state = makeTestState();
    state.lives = 1;
    drawThreeCells(state);
    applyDeath(state);
    expect(state.lives).toBe(0);
    expect(state.status).toBe('gameOver');
  });
});

describe('collision rules (spec 2.4)', () => {
  it('boss contact kills only a drawing player', () => {
    const state = makeTestState();
    drawThreeCells(state); // player drawing at (9,2)
    state.boss.pos = { x: 9.5, y: 3.0 }; // well within contact distance

    updatePlayerCollisions(state);
    expect(state.playerHit).toBe(true);
  });

  it('a shielded player is invulnerable to every enemy', () => {
    const state = makeTestState();
    state.player.pos = { x: 8, y: 0 };
    state.boss.pos = { x: 8.5, y: 0.5 }; // right on top of the player
    state.minions.push({
      kind: 'edgeCrawler',
      id: 1,
      alive: true,
      cell: { x: 8, y: 0 },
      dir: 'left',
      turn: 1,
      stepCooldown: 0,
      frozenFor: 0,
    });

    updatePlayerCollisions(state);
    expect(state.playerHit).toBe(false);
  });

  it('edge crawler contact kills a drawing player', () => {
    const state = makeTestState();
    drawThreeCells(state); // drawing at (9,2)
    state.minions.push({
      kind: 'edgeCrawler',
      id: 1,
      alive: true,
      cell: { x: 9, y: 3 }, // adjacent cell
      dir: 'left',
      turn: 1,
      stepCooldown: 0,
      frozenFor: 0,
    });

    updatePlayerCollisions(state);
    expect(state.playerHit).toBe(true);
  });

  it('does not kill a drawing player through a claimed wall (line-of-sight)', () => {
    const state = makeTestState();
    // player drawing at (5,5); a claimed wall column at x=6 separates them
    state.player.pos = { x: 5, y: 5 };
    state.player.mode = 'drawing';
    for (let y = 1; y <= 10; y++) state.grid.cells[y * state.grid.width + 6] = CellState.Claimed;
    state.boss.pos = { x: 7.0, y: 5.5 }; // 1.5 cells away but behind the wall

    updatePlayerCollisions(state);
    expect(state.playerHit).toBe(false);

    // remove the wall: now the boss really can touch the player
    for (let y = 1; y <= 10; y++) state.grid.cells[y * state.grid.width + 6] = CellState.Unclaimed;
    updatePlayerCollisions(state);
    expect(state.playerHit).toBe(true);
  });

  it('post-respawn invincibility suppresses contact deaths', () => {
    const state = makeTestState();
    drawThreeCells(state);
    state.player.invincibleFor = 1;
    state.boss.pos = { x: 9.5, y: 3.0 };

    updatePlayerCollisions(state);
    expect(state.playerHit).toBe(false);
  });
});
