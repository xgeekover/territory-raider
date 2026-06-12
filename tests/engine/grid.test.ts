import { describe, expect, it } from 'vitest';
import { CellState } from '../../src/engine/core/types';
import {
  claimRatio,
  createGrid,
  floodFillUnclaimed,
  cellIndex,
  getCell,
  isWalkable,
  setCell,
} from '../../src/engine/core/grid';

describe('createGrid', () => {
  it('builds a BORDER ring around an UNCLAIMED interior', () => {
    const grid = createGrid(16, 12);
    expect(getCell(grid, 0, 0)).toBe(CellState.Border);
    expect(getCell(grid, 15, 11)).toBe(CellState.Border);
    expect(getCell(grid, 7, 0)).toBe(CellState.Border);
    expect(getCell(grid, 0, 5)).toBe(CellState.Border);
    expect(getCell(grid, 1, 1)).toBe(CellState.Unclaimed);
    expect(getCell(grid, 14, 10)).toBe(CellState.Unclaimed);
    expect(grid.interiorCells).toBe(14 * 10);
  });
});

describe('claim ratio (spec 2.1: interior cells only)', () => {
  it('is 0 with nothing claimed and counts only non-border cells', () => {
    const grid = createGrid(16, 12);
    expect(claimRatio(grid)).toBe(0);
    // claim a 14-cell row of the 140-cell interior
    for (let x = 1; x <= 14; x++) setCell(grid, x, 1, CellState.Claimed);
    expect(claimRatio(grid)).toBeCloseTo(14 / 140);
  });

  it('does not count BORDER cells as claimed', () => {
    const grid = createGrid(16, 12);
    // the 52 border ring cells must not contribute to the numerator
    expect(claimRatio(grid)).toBe(0);
  });
});

describe('isWalkable (boundary cells)', () => {
  it('border cells adjacent to the unclaimed interior are walkable', () => {
    const grid = createGrid(16, 12);
    expect(isWalkable(grid, 7, 0)).toBe(true);
    expect(isWalkable(grid, 0, 5)).toBe(true);
  });

  it('ring corners are walkable (8-neighborhood keeps the outline connected)', () => {
    const grid = createGrid(16, 12);
    expect(isWalkable(grid, 0, 0)).toBe(true);
    expect(isWalkable(grid, 15, 11)).toBe(true);
  });

  it('claimed cells with no open neighbor are not walkable', () => {
    const grid = createGrid(16, 12);
    // claim a 3x3 block plus its surroundings so the center is fully enclosed
    for (let y = 1; y <= 5; y++) {
      for (let x = 1; x <= 5; x++) setCell(grid, x, y, CellState.Claimed);
    }
    expect(isWalkable(grid, 3, 3)).toBe(false);
    expect(isWalkable(grid, 5, 3)).toBe(true); // frontier column
  });

  it('unclaimed cells are never walkable', () => {
    const grid = createGrid(16, 12);
    expect(isWalkable(grid, 7, 5)).toBe(false);
  });
});

describe('floodFillUnclaimed', () => {
  it('reaches the whole interior on a fresh grid', () => {
    const grid = createGrid(16, 12);
    const reachable = floodFillUnclaimed(grid, { x: 7, y: 5 });
    let count = 0;
    for (const v of reachable) count += v;
    expect(count).toBe(grid.interiorCells);
  });

  it('does not cross a TRAIL wall', () => {
    const grid = createGrid(16, 12);
    for (let y = 1; y <= 10; y++) setCell(grid, 8, y, CellState.Trail);
    const reachable = floodFillUnclaimed(grid, { x: 12, y: 5 });
    expect(reachable[cellIndex(grid, 12, 5)]).toBe(1);
    expect(reachable[cellIndex(grid, 9, 5)]).toBe(1);
    expect(reachable[cellIndex(grid, 8, 5)]).toBe(0); // the wall itself
    expect(reachable[cellIndex(grid, 7, 5)]).toBe(0); // far side
  });

  it('returns an empty mask when the seed is not unclaimed', () => {
    const grid = createGrid(16, 12);
    const reachable = floodFillUnclaimed(grid, { x: 0, y: 0 });
    expect(reachable.every((v) => v === 0)).toBe(true);
  });
});
