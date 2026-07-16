import { CellState } from '../../src/engine/core/types';
import type { StageConfig, Vec2 } from '../../src/engine/core/types';
import { cellIndex, getCell, setCell } from '../../src/engine/core/grid';
import { createStageState } from '../../src/engine/core/gameState';
import type { GameState, StateOptions } from '../../src/engine/core/gameState';

/** A quiet stage so fixtures control every entity explicitly. */
export const TEST_STAGE: StageConfig = {
  bossSpeed: 10,
  bossHp: 3,
  wandererCount: 0,
  edgeCrawlerCount: 0,
  sparkSpeed: 10,
  itemTiles: [],
  bgColor: '#123456',
};

/** Like TEST_STAGE but with the boss battle active (projectiles + rage). */
export const TEST_BOSS_STAGE: StageConfig = {
  ...TEST_STAGE,
  bossBattle: true,
  bossFireCooldown: 2.8,
  projectileSpeed: 15,
};

/** Deterministic small-grid state for engine unit tests (default 16x12). */
export function makeTestState(options: StateOptions = {}): GameState {
  return createStageState({
    width: 16,
    height: 12,
    seed: 42,
    stages: [TEST_STAGE],
    stageIndex: 0,
    ...options,
  });
}

/** Lay a trail through the given cells, as if the player had drawn it. */
export function layTrail(state: GameState, cells: Vec2[], startCell: Vec2): void {
  state.trail.startCell = { ...startCell };
  state.trail.cells = cells.map((c) => ({ ...c }));
  state.trail.set = new Set(cells.map((c) => cellIndex(state.grid, c.x, c.y)));
  for (const c of cells) {
    setCell(state.grid, c.x, c.y, CellState.Trail);
  }
  const last = cells[cells.length - 1];
  if (last) state.player.pos = { ...last };
  state.player.mode = 'drawing';
}

export function cellAt(state: GameState, x: number, y: number): CellState {
  return getCell(state.grid, x, y);
}

/** Place the boss's center in the middle of the given cell. */
export function placeBoss(state: GameState, cell: Vec2): void {
  state.boss.pos = { x: cell.x + 0.5, y: cell.y + 0.5 };
}
