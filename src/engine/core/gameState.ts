import { CellState, DIR_VECTORS } from './types';
import type {
  BossProjectile,
  BossState,
  GameStatus,
  ItemCode,
  ItemTile,
  LaserShot,
  LightningArc,
  MinionState,
  PlayerState,
  SparkState,
  StageConfig,
  TrailState,
  Vec2,
} from './types';
import { cellIndex, createGrid, getCell, isWalkable, setCell } from './grid';
import type { Grid } from './grid';
import { mulberry32 } from './rng';
import type { Rng } from './rng';
import {
  BOSS_FIRE_COOLDOWN,
  FIELD_FEATURE_CENTER_CLEARANCE,
  FIELD_FEATURE_MARGIN,
  GRID_HEIGHT,
  GRID_WIDTH,
  ITEM_MIN_SEPARATION,
  ITEM_PLACEMENT_MARGIN,
  STAGE_TIME_LIMIT,
  START_LIVES,
  WANDERER_SPEED,
} from '../config/constants';
import { getStage } from '../config/stages';

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
  /** Boss-battle projectiles in flight (unclaimed space only). */
  projectiles: BossProjectile[];
  items: ItemTile[];
  /**
   * Hazard cells (indices into grid.cells) of this stage's elemental theme.
   * The cells themselves stay UNCLAIMED (enemies roam over them; only a
   * drawing player triggers them). Claiming over a hazard cleanses it.
   */
  hazards: Set<number>;
  /** Chain-lightning arcs currently visible (lightning theme), fading by ttl. */
  lightningArcs: LightningArc[];
  score: number;
  lives: number;
  claimRatio: number;
  /**
   * Seconds left on the stage countdown for the current life. Refilled to
   * STAGE_TIME_LIMIT on stage entry and on every respawn; hitting 0 costs a life.
   */
  stageTimeLeft: number;
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
  /** Start already in play instead of on the title screen (tests / dev stage-select). */
  startPlaying?: boolean;
}

let nextMinionId = 1;

/**
 * Grow an organic blob of ~`size` cells by random walk from a seed placed
 * away from the border ring (corridors along edges must stay open) and the
 * field center (the boss spawns there). Returns the accepted cells; cells
 * failing `ok` are skipped, so blobs flow around earlier features.
 */
function growBlob(
  grid: Grid,
  rng: Rng,
  size: number,
  ok: (x: number, y: number) => boolean,
): Vec2[] {
  const { width, height } = grid;
  const margin = Math.min(FIELD_FEATURE_MARGIN, Math.floor(Math.min(width, height) / 4));
  const clearR = Math.min(FIELD_FEATURE_CENTER_CLEARANCE, Math.floor(Math.min(width, height) / 3));
  const cx = width / 2;
  const cy = height / 2;

  let seed: Vec2 | null = null;
  for (let attempt = 0; attempt < 60 && !seed; attempt++) {
    const x = margin + Math.floor(rng() * (width - 2 * margin));
    const y = margin + Math.floor(rng() * (height - 2 * margin));
    if (Math.hypot(x - cx, y - cy) < clearR) continue;
    if (ok(x, y)) seed = { x, y };
  }
  if (!seed) return [];

  const cells: Vec2[] = [seed];
  const taken = new Set<number>([cellIndex(grid, seed.x, seed.y)]);
  let cur = seed;
  for (let step = 0; step < size * 3 && cells.length < size; step++) {
    const dirs = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ];
    const d = dirs[Math.floor(rng() * 4)]!;
    const nx = cur.x + d.x;
    const ny = cur.y + d.y;
    if (
      nx < margin ||
      ny < margin ||
      nx >= grid.width - margin ||
      ny >= grid.height - margin ||
      Math.hypot(nx - cx, ny - cy) < clearR
    ) {
      cur = cells[Math.floor(rng() * cells.length)]!; // restart walk inside the blob
      continue;
    }
    cur = { x: nx, y: ny };
    const idx = cellIndex(grid, nx, ny);
    if (!taken.has(idx) && ok(nx, ny)) {
      taken.add(idx);
      cells.push(cur);
    }
  }
  return cells;
}

/** Rock clusters: cells become OBSTACLE and leave the claimable pool. */
function placeObstacles(stage: StageConfig, grid: Grid, rng: Rng): void {
  const clusters = stage.obstacleClusters ?? 0;
  for (let c = 0; c < clusters; c++) {
    const size = 6 + Math.floor(rng() * 8);
    const cells = growBlob(grid, rng, size, (x, y) => getCell(grid, x, y) === CellState.Unclaimed);
    for (const cell of cells) {
      setCell(grid, cell.x, cell.y, CellState.Obstacle);
    }
    grid.interiorCells -= cells.length; // never claimable — keep 80% reachable
  }
}

/** Hazard patches: cells stay UNCLAIMED, only marked in the hazard set. */
function placeHazards(stage: StageConfig, grid: Grid, rng: Rng): Set<number> {
  const hazards = new Set<number>();
  if (!stage.theme) return hazards;
  const patches = stage.hazardPatches ?? 0;
  for (let p = 0; p < patches; p++) {
    const size = 10 + Math.floor(rng() * 10);
    const cells = growBlob(
      grid,
      rng,
      size,
      (x, y) =>
        getCell(grid, x, y) === CellState.Unclaimed && !hazards.has(cellIndex(grid, x, y)),
    );
    for (const cell of cells) {
      hazards.add(cellIndex(grid, cell.x, cell.y));
    }
  }
  return hazards;
}

function spawnBoss(stage: StageConfig, width: number, height: number, rng: Rng): BossState {
  const angle = rng() * Math.PI * 2;
  return {
    pos: { x: width / 2, y: height / 2 },
    vel: { x: Math.cos(angle) * stage.bossSpeed, y: Math.sin(angle) * stage.bossSpeed },
    hp: stage.bossHp,
    alive: true,
    sparkCooldown: 0,
    // First volley comes after one full cooldown — no shot on stage entry.
    fireCooldown: stage.bossFireCooldown ?? BOSS_FIRE_COOLDOWN,
  };
}

function spawnMinions(stage: StageConfig, grid: Grid, rng: Rng): MinionState[] {
  const minions: MinionState[] = [];
  const { width, height } = grid;
  for (let i = 0; i < stage.wandererCount; i++) {
    const angle = rng() * Math.PI * 2;
    // Resample so a wanderer never spawns inside a rock (it would be stuck).
    let pos: Vec2 = { x: width / 2, y: height / 2 };
    for (let attempt = 0; attempt < 30; attempt++) {
      const candidate = { x: 4 + rng() * (width - 8), y: 4 + rng() * (height - 8) };
      if (getCell(grid, Math.floor(candidate.x), Math.floor(candidate.y)) === CellState.Unclaimed) {
        pos = candidate;
        break;
      }
    }
    minions.push({
      kind: 'wanderer',
      id: nextMinionId++,
      alive: true,
      pos,
      vel: { x: Math.cos(angle) * WANDERER_SPEED, y: Math.sin(angle) * WANDERER_SPEED },
      sparkCooldown: 0,
      frozenFor: 0,
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
      frozenFor: 0,
    });
  }
  return minions;
}

function placeItems(codes: ItemCode[], grid: Grid, rng: Rng, hazards: Set<number>): ItemTile[] {
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
      if (hazards.has(cellIndex(grid, candidate.x, candidate.y))) continue; // no bait
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
  const stageIndex = options.stageIndex ?? 0;
  // Tests may pin an explicit finite stage list; the real game generates each
  // stage on demand so the campaign is endless.
  const stage = options.stages
    ? (options.stages[Math.min(stageIndex, options.stages.length - 1)] as StageConfig)
    : getStage(stageIndex);
  const rng = mulberry32(options.seed ?? (Math.random() * 0xffffffff) >>> 0);
  const grid = createGrid(width, height);
  placeObstacles(stage, grid, rng);
  const hazards = placeHazards(stage, grid, rng);

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
    slowedFor: 0,
    stunnedFor: 0,
    hazardGraceFor: 0,
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
    projectiles: [],
    items: placeItems(stage.itemTiles, grid, rng, hazards),
    hazards,
    lightningArcs: [],
    score: carry?.score ?? 0,
    lives: carry?.lives ?? START_LIVES,
    claimRatio: 0,
    stageTimeLeft: STAGE_TIME_LIMIT,
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
