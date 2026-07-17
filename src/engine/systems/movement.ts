import { CellState, DIR_VECTORS } from '../core/types';
import type { Direction, InputState, PlayerState, Vec2 } from '../core/types';
import { cellIndex, getCell, inBounds, isWalkable } from '../core/grid';
import type { GameState } from '../core/gameState';
import {
  HAZARD_GRACE,
  HAZARD_SLOW_DURATION,
  HAZARD_SLOW_FACTOR,
  HAZARD_STUN_DURATION,
  PLAYER_SPEED,
} from '../config/constants';
import { commitTrail, rollbackTrail } from './claim';

/** Seconds per cell step, including the item speed boost and ice-hazard slow.
 *  Shared with the renderer so visual interpolation matches the simulation. */
export function playerStepPeriod(p: PlayerState): number {
  const slow = p.slowedFor > 0 ? HAZARD_SLOW_FACTOR : 1;
  return 1 / (PLAYER_SPEED * p.speedMultiplier * slow);
}

/**
 * Fixed-tick player movement. The player steps one cell at a time at
 * PLAYER_SPEED cells/sec (scaled by item speed boost and hazard slow); a
 * cooldown accumulator spaces the steps across ticks. A lightning stun holds
 * the accumulator entirely — no steps bank up while frozen.
 */
export function updatePlayer(state: GameState, input: InputState, dt: number): void {
  const p = state.player;
  if (p.stunnedFor > 0) return;
  const period = playerStepPeriod(p);
  // Carry the sub-tick remainder forward (a true fixed-timestep accumulator),
  // so the average step rate equals the configured speed instead of being
  // quantized down by clamping to 0. Floor the debt at one period so a long
  // block can't bank many steps and lurch the player on reopen (max 2 steps).
  p.moveCooldown = Math.max(-period, p.moveCooldown - dt);
  while (p.moveCooldown <= 0 && state.status === 'playing') {
    if (!tryStep(state, input)) break;
    p.moveCooldown += period;
  }
}

/** Attempt one step using held directions, most recent first. Returns true if the player moved. */
export function tryStep(state: GameState, input: InputState): boolean {
  for (const dir of input.dirs) {
    const stepped =
      state.player.mode === 'shield'
        ? stepShield(state, dir, input.action)
        : stepDrawing(state, dir, input.action);
    if (stepped) {
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
 * Shield mode (spec 2.2): the player may only walk on boundary cells (claimed
 * cells on the frontier of the unclaimed area) and cannot be killed. Holding
 * the action key and stepping into an UNCLAIMED cell enters drawing mode.
 */
function stepShield(state: GameState, dir: Direction, action: boolean): boolean {
  const target = targetOf(state, dir);
  if (!target) return false;
  const cell = getCell(state.grid, target.x, target.y);

  if (cell === CellState.Unclaimed) {
    if (!action) return false;
    startDrawing(state, target);
    return true;
  }
  if (isWalkable(state.grid, target.x, target.y)) {
    state.player.pos = target;
    return true;
  }
  return false;
}

function startDrawing(state: GameState, firstCell: Vec2): void {
  state.trail.startCell = { ...state.player.pos };
  state.trail.cells = [];
  state.trail.set.clear();
  pushTrailCell(state, firstCell);
  state.player.pos = firstCell;
  state.player.mode = 'drawing';
  triggerHazard(state);
}

/**
 * Elemental hazards (spec: themed blocks every 10 stages). Entering a hazard
 * cell while drawing applies the theme effect:
 *  - fire: the whole cut burns away (trail rolls back, player returns to the
 *    cell drawing started from — like a death, but no life is lost). Fire
 *    ignores the grace window: every entry burns, so a flame patch can never
 *    be drawn through — encircle and claim over it to cleanse it instead.
 *  - ice: movement is halved for a few seconds
 *  - lightning: the player is frozen solid for a moment
 * Ice/lightning set a short grace so one patch cannot chain-trigger on every
 * subsequent cell the player crosses.
 */
function triggerHazard(state: GameState): void {
  const p = state.player;
  const theme = state.stage.theme;
  if (!theme) return;
  if (!state.hazards.has(cellIndex(state.grid, p.pos.x, p.pos.y))) return;
  if (theme === 'fire') {
    const respawn = state.trail.startCell ?? p.pos;
    rollbackTrail(state); // restores UNCLAIMED, clears sparks, shield mode
    p.pos = { ...respawn };
    p.moveCooldown = 0;
    return;
  }
  if (p.hazardGraceFor > 0) return;
  p.hazardGraceFor = HAZARD_GRACE;
  if (theme === 'ice') p.slowedFor = HAZARD_SLOW_DURATION;
  else p.stunnedFor = HAZARD_STUN_DURATION;
}

function pushTrailCell(state: GameState, cell: Vec2): void {
  state.trail.cells.push(cell);
  state.trail.set.add(cellIndex(state.grid, cell.x, cell.y));
  state.grid.cells[cellIndex(state.grid, cell.x, cell.y)] = CellState.Trail;
}

/**
 * Drawing mode (spec 2.2): extend the trail through UNCLAIMED cells; standing
 * still is allowed. Moving onto the own trail is forbidden — the trail Set
 * makes this O(1), and it also covers backtracking, since the previous cell
 * is always TRAIL. Stepping back onto the start cell with a 1-cell trail is
 * the remaining backtrack case and is blocked explicitly. Stepping onto any
 * other CLAIMED/BORDER cell commits the trail (spec 2.3).
 */
function stepDrawing(state: GameState, dir: Direction, action: boolean): boolean {
  const target = targetOf(state, dir);
  if (!target) return false;
  const cell = getCell(state.grid, target.x, target.y);

  if (cell === CellState.Trail) return false; // self-crossing / backtrack
  if (cell === CellState.Obstacle) return false; // rock blocks the cut
  if (cell === CellState.Unclaimed) {
    if (!action) return false; // extending the cut requires the action key
    pushTrailCell(state, target);
    state.player.pos = target;
    triggerHazard(state);
    return true;
  }
  // CLAIMED or BORDER
  const start = state.trail.startCell;
  if (state.trail.cells.length === 1 && start && target.x === start.x && target.y === start.y) {
    return false; // backtracking onto the cell drawing started from
  }
  state.player.pos = target;
  commitTrail(state);
  return true;
}
