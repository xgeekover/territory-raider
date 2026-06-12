import { CellState } from './types';
import type { Vec2 } from './types';

export interface Grid {
  width: number;
  height: number;
  /** Row-major CellState values. */
  cells: Uint8Array;
  /** Number of non-BORDER cells; denominator of the claim ratio. */
  interiorCells: number;
}

export function cellIndex(grid: Grid, x: number, y: number): number {
  return y * grid.width + x;
}

export function inBounds(grid: Grid, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < grid.width && y < grid.height;
}

export function getCell(grid: Grid, x: number, y: number): CellState {
  return grid.cells[y * grid.width + x] as CellState;
}

export function setCell(grid: Grid, x: number, y: number, state: CellState): void {
  grid.cells[y * grid.width + x] = state;
}

/** Outermost 1-cell ring is BORDER (claimed from the start); interior is UNCLAIMED. */
export function createGrid(width: number, height: number): Grid {
  const cells = new Uint8Array(width * height).fill(CellState.Unclaimed);
  const grid: Grid = {
    width,
    height,
    cells,
    interiorCells: (width - 2) * (height - 2),
  };
  for (let x = 0; x < width; x++) {
    setCell(grid, x, 0, CellState.Border);
    setCell(grid, x, height - 1, CellState.Border);
  }
  for (let y = 0; y < height; y++) {
    setCell(grid, 0, y, CellState.Border);
    setCell(grid, width - 1, y, CellState.Border);
  }
  return grid;
}

export function isSolid(state: CellState): boolean {
  return state === CellState.Claimed || state === CellState.Border;
}

/**
 * A cell the shielded player (and edge crawlers) may stand on: CLAIMED or
 * BORDER with at least one UNCLAIMED/TRAIL neighbor in the 8-neighborhood.
 *
 * Deviation from spec 2.2 (which says 4-neighborhood), on purpose: with a
 * strict 4-neighbor test the corner cells of any rectilinear outline (e.g.
 * the very first border ring corners) touch open space only diagonally, so
 * they are dead ends and the player could never walk around a corner. The
 * 8-neighbor test keeps the walkable outline connected.
 */
export function isWalkable(grid: Grid, x: number, y: number): boolean {
  if (!inBounds(grid, x, y)) return false;
  if (!isSolid(getCell(grid, x, y))) return false;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(grid, nx, ny)) continue;
      if (!isSolid(getCell(grid, nx, ny))) return true;
    }
  }
  return false;
}

/**
 * BFS over UNCLAIMED cells (4-neighborhood) from `seed`.
 * Returns a per-cell mask: 1 = reachable. Used by the claim algorithm.
 */
export function floodFillUnclaimed(grid: Grid, seed: Vec2): Uint8Array {
  const reachable = new Uint8Array(grid.width * grid.height);
  if (!inBounds(grid, seed.x, seed.y)) return reachable;
  if (getCell(grid, seed.x, seed.y) !== CellState.Unclaimed) return reachable;

  const queue = new Int32Array(grid.width * grid.height);
  let head = 0;
  let tail = 0;
  const seedIdx = cellIndex(grid, seed.x, seed.y);
  reachable[seedIdx] = 1;
  queue[tail++] = seedIdx;

  const w = grid.width;
  while (head < tail) {
    const idx = queue[head++] as number;
    const x = idx % w;
    const y = (idx - x) / w;
    // 4-neighborhood
    if (x > 0) visit(idx - 1);
    if (x < w - 1) visit(idx + 1);
    if (y > 0) visit(idx - w);
    if (y < grid.height - 1) visit(idx + w);
  }

  function visit(idx: number): void {
    if (reachable[idx] === 0 && grid.cells[idx] === CellState.Unclaimed) {
      reachable[idx] = 1;
      queue[tail++] = idx;
    }
  }

  return reachable;
}

/** Claimed ratio over interior (non-BORDER) cells, per spec 2.1. */
export function claimRatio(grid: Grid): number {
  let claimed = 0;
  for (let y = 1; y < grid.height - 1; y++) {
    const rowStart = y * grid.width;
    for (let x = 1; x < grid.width - 1; x++) {
      if (grid.cells[rowStart + x] === CellState.Claimed) claimed++;
    }
  }
  return claimed / grid.interiorCells;
}

/**
 * Nearest walkable cell from `from`, searching by BFS through solid cells.
 * Used to snap the player back onto the frontier after a commit that left
 * them on a fully-enclosed claimed pocket, and to relocate edge crawlers.
 */
export function nearestWalkable(grid: Grid, from: Vec2): Vec2 {
  if (isWalkable(grid, from.x, from.y)) return from;
  const visited = new Uint8Array(grid.width * grid.height);
  const queue: Vec2[] = [from];
  visited[cellIndex(grid, from.x, from.y)] = 1;
  for (let i = 0; i < queue.length; i++) {
    const cur = queue[i] as Vec2;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (!inBounds(grid, nx, ny)) continue;
      const idx = cellIndex(grid, nx, ny);
      if (visited[idx] === 1) continue;
      if (!isSolid(getCell(grid, nx, ny))) continue;
      if (isWalkable(grid, nx, ny)) return { x: nx, y: ny };
      visited[idx] = 1;
      queue.push({ x: nx, y: ny });
    }
  }
  return from; // no frontier left (full claim) — caller handles stage clear
}
