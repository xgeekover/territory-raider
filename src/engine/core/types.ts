/** Cell states stored in the grid's Uint8Array. */
export const CellState = {
  Unclaimed: 0,
  Claimed: 1,
  Border: 2,
  Trail: 3,
} as const;
export type CellState = (typeof CellState)[keyof typeof CellState];

export interface Vec2 {
  x: number;
  y: number;
}

export type Direction = 'up' | 'down' | 'left' | 'right';

export const DIR_VECTORS: Record<Direction, Vec2> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export type ItemCode = 'T' | 'S' | 'L' | 'P' | 'C';

export type PlayerMode = 'shield' | 'drawing';

export type GameStatus =
  | 'title'
  | 'playing'
  | 'paused'
  | 'stageClear'
  | 'gameOver'
  | 'victory';

/** Held-key input sampled once per fixed tick. `dirs` is ordered most-recently-pressed first. */
export interface InputState {
  dirs: Direction[];
  action: boolean;
}

export interface PlayerState {
  /** Integer cell coordinates. */
  pos: Vec2;
  facing: Direction;
  mode: PlayerMode;
  /** Seconds until the next cell step is allowed. */
  moveCooldown: number;
  speedMultiplier: number;
  /** Seconds of post-respawn invincibility remaining. */
  invincibleFor: number;
}

/**
 * Trail kept as an ordered array (spark pathing, rollback) plus a Set of
 * cell indices (O(1) self-crossing checks), per spec 2.2.
 */
export interface TrailState {
  cells: Vec2[];
  set: Set<number>;
  /** Last safe (claimed) cell before drawing started; respawn point. */
  startCell: Vec2 | null;
}

export interface BossState {
  /** Float position in cell units (center of the boss). */
  pos: Vec2;
  /** Velocity in cells/sec. */
  vel: Vec2;
  hp: number;
  alive: boolean;
  /** Seconds until this enemy may spawn another spark. */
  sparkCooldown: number;
}

export interface WandererState {
  kind: 'wanderer';
  id: number;
  alive: boolean;
  pos: Vec2;
  vel: Vec2;
  sparkCooldown: number;
}

export interface EdgeCrawlerState {
  kind: 'edgeCrawler';
  id: number;
  alive: boolean;
  /** Integer cell coordinates; crawlers walk the boundary-cell graph. */
  cell: Vec2;
  dir: Direction;
  /** 1 = clockwise wall-following, -1 = counter-clockwise. */
  turn: 1 | -1;
  stepCooldown: number;
}

export type MinionState = WandererState | EdgeCrawlerState;
export type MinionKind = MinionState['kind'];

export interface SparkState {
  /** Float index into trail.cells; advances toward the trail head (player). */
  trailIndex: number;
}

export interface ItemTile {
  code: ItemCode;
  cell: Vec2;
  collected: boolean;
}

export interface LaserShot {
  /** Float position in cell units. */
  pos: Vec2;
  dir: Direction;
}

export interface StageConfig {
  bossSpeed: number; // cells/sec
  bossHp: number;
  wandererCount: number;
  edgeCrawlerCount: number;
  sparkSpeed: number; // trail cells/sec
  itemTiles: ItemCode[]; // item kinds appearing on this stage
  bgColor: string; // background revealed on claimed area (per-stage)
}

/** Immutable snapshot consumed by React HUD via useSyncExternalStore. */
export interface HudSnapshot {
  status: GameStatus;
  score: number;
  lives: number;
  stage: number; // 1-based for display
  claimPct: number; // 0..100, one decimal
  laserAmmo: number;
  timeStopFor: number; // seconds remaining, 1 decimal
  speedBoost: boolean;
  lastClearBonus: number;
  bossHp: number;
  bossAlive: boolean;
}
