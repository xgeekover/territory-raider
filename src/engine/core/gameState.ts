import { CellState, DIR_VECTORS } from './types';
import type {
  BossState,
  GameStatus,
  ItemCode,
  ItemTile,
  LaserShot,
  MinionState,
  PlayerState,
  SparkState,
  StageConfig,
  TrailState,
  Vec2,
} from './types';
import { createGrid, getCell, isWalkable } from './grid';
import type { Grid } from './grid';
import { mulberry32 } from './rng';
import type { Rng } from './rng';
import {
  GRID_HEIGHT,
  GRID_WIDTH,
  ITEM_MIN_SEPARATION,
  ITEM_PLACEMENT_MARGIN,
  START_LIVES,
  WANDERER_SPEED,
} from '../config/constants';
import { STAGES } from '../config/stages';

export interface GameState {
  status: GameStatus;
  stageIndex: number;
  stage: StageConfig;
  grid: Grid;
  /** Bumped on every grid mutation that should redraw the static layer. */
  gridVersion: number;
  player: PlayerState;
  trail: TrailState;
  boss: BossState;
  minions: MinionState[];
  sparks: SparkState[];
  lasers: LaserShot[];
  items: ItemTile[];
  score: number;
  lives: number;
  claimRatio: number;
  /** Seconds of remaining Time Stop (item 'T'); freezes all enemies and sparks. */
  timeStopFor: number;
  laserAmmo: number;
  /** Set by collision/spark systems within a tick; engine resolves it once. */
  playerHit: boolean;
  /** True when the current stage was cleared by killing the boss with the laser. */
  bossKillClear: boolean;
  /** Clear-screen display: over-80% bonus (+ boss-kill bonus) of the last clear. */
  lastClearBonus: number;
  rng: Rng;
}

export interface StateOptions {
  width?: number;
  height?: number;
  stageIndex?: number;
  seed?: number;
  stages?: StageConfig[];
}

let nextMinionId = 1;

function spawnBoss(stage: StageConfig, width: number, height: number, rng: Rng): BossState {
  const angle = rng() * Math.PI * 2;
  return {
    pos: { x: width / 2, y: height / 2 },
    vel: { x: Math.cos(angle) * stage.bossSpeed, y: Math.sin(angle) * stage.bossSpeed },
    hp: stage.bossHp,
    alive: true,
    sparkCooldown: 0,
  };
}

function spawnMinions(stage: StageConfig, grid: Grid, rng: Rng): MinionState[] {
  const minions: MinionState[] = [];
  const { width, height } = grid;
  for (let i = 0; i < stage.wandererCount; i++) {
    const angle = rng() * Math.PI * 2;
    minions.push({
      kind: 'wanderer',
      id: nextMinionId++,
      alive: true,
      pos: {
        x: 4 + rng() * (width - 8),
        y: 4 + rng() * (height - 8),
      },
      vel: { x: Math.cos(angle) * WANDERER_SPEED, y: Math.sin(angle) * WANDERER_SPEED },
      sparkCooldown: 0,
    });
  }
  // Crawlers start on the border ring, spread along the bottom/side edges
  // (away from the player spawn at top-center), alternating direction.
  for (let i = 0; i < stage.edgeCrawlerCount; i++) {
    const t = (i + 1) / (stage.edgeCrawlerCount + 1);
    const cell: Vec2 = { x: 1 + Math.floor(t * (width - 2)), y: height - 1 };
    minions.push({
      kind: 'edgeCrawler',
      id: nextMinionId++,
      alive: true,
      cell,
      dir: i % 2 === 0 ? 'left' : 'right',
      turn: i % 2 === 0 ? 1 : -1,
      stepCooldown: 0,
    });
  }
  return minions;
}

function placeItems(codes: ItemCode[], grid: Grid, rng: Rng): ItemTile[] {
  const items: ItemTile[] = [];
  const { width, height } = grid;
  const m = Math.min(ITEM_PLACEMENT_MARGIN, Math.floor(Math.min(width, height) / 4));
  for (const code of codes) {
    let cell: Vec2 = { x: width / 2, y: height / 2 };
    for (let attempt = 0; attempt < 50; attempt++) {
      const candidate: Vec2 = {
        x: m + Math.floor(rng() * (width - 2 * m)),
        y: m + Math.floor(rng() * (height - 2 * m)),
      };
      if (getCell(grid, candidate.x, candidate.y) !== CellState.Unclaimed) continue;
      const farEnough = items.every(
        (it) =>
          Math.abs(it.cell.x - candidate.x) + Math.abs(it.cell.y - candidate.y) >=
          ITEM_MIN_SEPARATION,
      );
      cell = candidate;
      if (farEnough) break;
    }
    items.push({ code, cell, collected: false });
  }
  return items;
}

/** Build a fresh state for one stage. Score/lives carry across stages via `carry`. */
export function createStageState(
  options: StateOptions = {},
  carry?: { score: number; lives: number },
): GameState {
  const width = options.width ?? GRID_WIDTH;
  const height = options.height ?? GRID_HEIGHT;
  const stages = options.stages ?? STAGES;
  const stageIndex = options.stageIndex ?? 0;
  const stage = stages[Math.min(stageIndex, stages.length - 1)] as StageConfig;
  const rng = mulberry32(options.seed ?? (Math.random() * 0xffffffff) >>> 0);
  const grid = createGrid(width, height);

  const playerPos: Vec2 = { x: Math.floor(width / 2), y: 0 };
  if (!isWalkable(grid, playerPos.x, playerPos.y)) {
    playerPos.x = 1; // tiny test grids: any non-corner border cell works
  }

  const player: PlayerState = {
    pos: playerPos,
    facing: 'down',
    mode: 'shield',
    moveCooldown: 0,
    speedMultiplier: 1,
    invincibleFor: 0,
  };

  const trail: TrailState = { cells: [], set: new Set(), startCell: null };

  return {
    status: 'playing',
    stageIndex,
    stage,
    grid,
    gridVersion: 0,
    player,
    trail,
    boss: spawnBoss(stage, width, height, rng),
    minions: spawnMinions(stage, grid, rng),
    sparks: [],
    lasers: [],
    items: placeItems(stage.itemTiles, grid, rng),
    score: carry?.score ?? 0,
    lives: carry?.lives ?? START_LIVES,
    claimRatio: 0,
    timeStopFor: 0,
    laserAmmo: 0,
    playerHit: false,
    bossKillClear: false,
    lastClearBonus: 0,
    rng,
  };
}

/** Player facing as a unit vector. */
export function facingVector(player: PlayerState): Vec2 {
  return DIR_VECTORS[player.facing];
}
