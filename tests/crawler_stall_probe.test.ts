import { describe, it, expect } from 'vitest';
import { CellState } from '../src/engine/core/types';
import { createGrid, setCell, isWalkable } from '../src/engine/core/grid';
import type { Grid } from '../src/engine/core/grid';

// Helper: does this walkable cell have at least one walkable 4-neighbor?
function hasWalkable4Neighbor(grid: Grid, x: number, y: number): boolean {
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    if (isWalkable(grid, x + dx, y + dy)) return true;
  }
  return false;
}

describe('crawler stall geometry probe', () => {
  it('searches for a walkable cell whose 4-neighbors are all non-walkable (diagonal-only contact)', () => {
    // Build a small all-Claimed interior on a Border-ringed grid, then carve
    // a single UNCLAIMED cell so that exactly ONE claimed cell touches it only
    // diagonally. That claimed cell becomes walkable via 8-neighbor test but
    // may have no walkable 4-neighbor.
    const W = 12;
    const H = 12;
    const grid = createGrid(W, H);
    // Fill the interior fully with CLAIMED.
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        setCell(grid, x, y, CellState.Claimed);
      }
    }

    // Carve a single unclaimed hole.
    // We want a claimed cell C whose ONLY open (unclaimed) contact is diagonal.
    // Make a 2x2 unclaimed block but leave the cell diagonally adjacent claimed,
    // and surround that claimed cell's 4-neighbors with claimed cells.
    // Carve unclaimed at (5,5). Then cell (4,4) touches (5,5) only diagonally.
    // But (4,4) also has 4-neighbors (4,5),(5,4),(3,4),(4,3) that are claimed.
    // Are those neighbors walkable? (5,4) touches (5,5) -> open -> walkable.
    // So (4,4) WOULD have a walkable 4-neighbor. We need to isolate harder.
    //
    // Construct a "checkerboard nub": carve unclaimed so the target claimed
    // cell's 4-neighbors each touch NO open cell. That requires the open cell
    // to be reachable from target only diagonally AND not orthogonally adjacent
    // to any of target's 4-neighbors. A single isolated unclaimed cell at a
    // diagonal can never be 4-adjacent to target's 4-neighbors without making
    // one of them walkable... let's just brute-force search all single-hole and
    // small-hole carvings.

    // Reset: try every single unclaimed cell placement and check.
    let found: { hole: [number, number]; cell: [number, number] } | null = null;
    for (let hy = 1; hy < H - 1 && !found; hy++) {
      for (let hx = 1; hx < W - 1 && !found; hx++) {
        // fresh grid each time
        const g = createGrid(W, H);
        for (let y = 1; y < H - 1; y++) {
          for (let x = 1; x < W - 1; x++) setCell(g, x, y, CellState.Claimed);
        }
        setCell(g, hx, hy, CellState.Unclaimed);
        // scan all cells for a walkable cell with no walkable 4-neighbor
        for (let y = 0; y < H && !found; y++) {
          for (let x = 0; x < W && !found; x++) {
            if (isWalkable(g, x, y) && !hasWalkable4Neighbor(g, x, y)) {
              found = { hole: [hx, hy], cell: [x, y] };
            }
          }
        }
      }
    }
    console.log('single-hole search result:', found);
    expect(found).toBeNull(); // assert NONE found for single holes
  });
});
