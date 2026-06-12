import { CellState, DIR_VECTORS } from '../core/types';
import type { Direction, InputState, Vec2 } from '../core/types';
import { getCell, inBounds, isWalkable } from '../core/grid';
import type { GameState } from '../core/gameState';
import { PLAYER_SPEED } from '../config/constants';

/**
 * Fixed-tick player movement. The player steps one cell at a time at
 * PLAYER_SPEED cells/sec (scaled by item speed boost); a cooldown accumulator
 * spaces the steps across ticks.
 */
export function updatePlayer(state: GameState, input: InputState, dt: number): void {
  const p = state.player;
  p.moveCooldown = Math.max(0, p.moveCooldown - dt);
  while (p.moveCooldown <= 0) {
    if (!tryStep(state, input)) break;
    p.moveCooldown += 1 / (PLAYER_SPEED * p.speedMultiplier);
  }
}

/** Attempt one step using held directions, most recent first. Returns true if the player moved. */
export function tryStep(state: GameState, input: InputState): boolean {
  for (const dir of input.dirs) {
    if (stepShield(state, dir, input.action)) {
      state.player.facing = dir;
      return true;
    }
  }
  return false;
}

function targetOf(state: GameState, dir: Direction): Vec2 | null {
  const v = DIR_VECTORS[dir];
  const t = { x: state.player.pos.x + v.x, y: state.player.pos.y + v.y };
  return inBounds(state.grid, t.x, t.y) ? t : null;
}

/**
 * Shield mode: the player may only walk on boundary cells (claimed cells on
 * the frontier of the unclaimed area). Drawing mode arrives in M2.
 */
function stepShield(state: GameState, dir: Direction, _action: boolean): boolean {
  const target = targetOf(state, dir);
  if (!target) return false;
  const cell = getCell(state.grid, target.x, target.y);
  if (cell === CellState.Unclaimed) return false;
  if (isWalkable(state.grid, target.x, target.y)) {
    state.player.pos = target;
    return true;
  }
  return false;
}
