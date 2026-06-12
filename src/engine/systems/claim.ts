import { CellState } from '../core/types';
import type { ItemCode, Vec2 } from '../core/types';
import {
  cellIndex,
  claimRatio,
  floodFillUnclaimed,
  getCell,
  inBounds,
  isWalkable,
  nearestWalkable,
  setCell,
} from '../core/grid';
import type { GameState } from '../core/gameState';
import { applyClaimScore, applyTrapBonus, checkStageClear } from './scoring';

export interface ClaimOutcome {
  /** All cells converted to CLAIMED by this closure (trail + enclosed). */
  claimedCells: number;
  trappedMinions: number;
  collectedItems: ItemCode[];
  stageCleared: boolean;
}

/**
 * The boss's grid cell, used as the flood-fill seed. The boss bounces off
 * solid cells so its center cell is always UNCLAIMED; the neighbor scan is a
 * defensive fallback against float-edge rounding.
 */
function bossSeedCell(state: GameState): Vec2 | null {
  const { grid, boss } = state;
  const cx = Math.floor(boss.pos.x);
  const cy = Math.floor(boss.pos.y);
  if (inBounds(grid, cx, cy) && getCell(grid, cx, cy) === CellState.Unclaimed) {
    return { x: cx, y: cy };
  }
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (inBounds(grid, nx, ny) && getCell(grid, nx, ny) === CellState.Unclaimed) {
        return { x: nx, y: ny };
      }
    }
  }
  return null;
}

/** Destroy live minions standing on newly claimed cells (spec 2.3 step 4). */
function destroyTrappedMinions(state: GameState, newlyClaimed: Uint8Array): number {
  let trapped = 0;
  for (const m of state.minions) {
    if (!m.alive) continue;
    const cell = m.kind === 'wanderer' ? { x: Math.floor(m.pos.x), y: Math.floor(m.pos.y) } : m.cell;
    if (!inBounds(state.grid, cell.x, cell.y)) continue;
    if (newlyClaimed[cellIndex(state.grid, cell.x, cell.y)] === 1) {
      m.alive = false;
      trapped++;
    }
  }
  return trapped;
}

/** Items whose tile just became claimed are auto-acquired exactly once (spec 2.6). */
function collectClaimedItems(state: GameState): ItemCode[] {
  const collected: ItemCode[] = [];
  for (const item of state.items) {
    if (item.collected) continue;
    if (getCell(state.grid, item.cell.x, item.cell.y) !== CellState.Claimed) continue;
    item.collected = true;
    applyItemEffect(state, item.code);
    collected.push(item.code);
  }
  return collected;
}

/** Effects land in M4; collection bookkeeping (once-only) is already final. */
function applyItemEffect(_state: GameState, _code: ItemCode): void {}

/**
 * Trail closure — the heart of the game (spec 2.3):
 *  1. all TRAIL cells become CLAIMED
 *  2. flood fill UNCLAIMED cells from the boss cell -> `reachable`
 *  3. every UNCLAIMED cell not reachable becomes CLAIMED (only the region the
 *     boss is NOT trapped in stays unclaimed); slivers fall out naturally
 *  4. minions on newly claimed cells die -> trap bonus
 *  5. items inside the newly claimed area are auto-acquired
 *  6. recompute ratio, score the closure, check the 80% clear
 *  7. drop all live sparks
 * With the boss already dead there is no seed: everything is claimed.
 */
export function commitTrail(state: GameState): ClaimOutcome {
  const { grid, trail } = state;
  const newlyClaimed = new Uint8Array(grid.cells.length);
  let claimedCount = 0;

  // 1. TRAIL -> CLAIMED
  for (const c of trail.cells) {
    setCell(grid, c.x, c.y, CellState.Claimed);
    newlyClaimed[cellIndex(grid, c.x, c.y)] = 1;
    claimedCount++;
  }

  // 2-3. flood fill from the boss; unreachable unclaimed cells flip
  const seed = state.boss.alive ? bossSeedCell(state) : null;
  const reachable = seed ? floodFillUnclaimed(grid, seed) : null;
  for (let i = 0; i < grid.cells.length; i++) {
    if (grid.cells[i] === CellState.Unclaimed && (reachable === null || reachable[i] === 0)) {
      grid.cells[i] = CellState.Claimed;
      newlyClaimed[i] = 1;
      claimedCount++;
    }
  }

  // 4. trapped minions
  const trapped = destroyTrappedMinions(state, newlyClaimed);
  applyTrapBonus(state, trapped);

  // 5. items inside the claimed area
  const collectedItems = collectClaimedItems(state);

  // 6. ratio + closure score + clear check
  state.claimRatio = claimRatio(grid);
  applyClaimScore(state, claimedCount);
  const stageCleared = checkStageClear(state);

  // 7. sparks die with the trail
  state.sparks = [];

  resetTrail(state);
  state.player.mode = 'shield';
  // A closure can strand the player on a fully-enclosed pocket (every
  // neighbor claimed); snap back to the nearest frontier cell so the
  // "boundary cells only" movement rule cannot soft-lock the game.
  if (!isWalkable(grid, state.player.pos.x, state.player.pos.y)) {
    state.player.pos = nearestWalkable(grid, state.player.pos);
  }
  state.gridVersion++;

  return { claimedCells: claimedCount, trappedMinions: trapped, collectedItems, stageCleared };
}

/**
 * Death rollback (spec 2.5): the whole trail reverts to UNCLAIMED, so the
 * claim ratio is untouched; sparks disappear with it.
 */
export function rollbackTrail(state: GameState): void {
  for (const c of state.trail.cells) {
    setCell(state.grid, c.x, c.y, CellState.Unclaimed);
  }
  state.sparks = [];
  resetTrail(state);
  state.player.mode = 'shield';
  state.gridVersion++;
}

function resetTrail(state: GameState): void {
  state.trail.cells = [];
  state.trail.set.clear();
  state.trail.startCell = null;
}
