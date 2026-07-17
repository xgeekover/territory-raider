import { CellState, DIR_VECTORS } from '../core/types';
import type { Direction, EdgeCrawlerState, MinionState, Vec2, WandererState } from '../core/types';
import { getCell, inBounds, isWalkable, nearestWalkable } from '../core/grid';
import type { Grid } from '../core/grid';
import type { GameState } from '../core/gameState';
import {
  BOUNCE_JITTER_DEG,
  EDGE_CRAWLER_SPEED,
  ENEMY_SPEED_SCALE_DANGER,
  ENEMY_SPEED_SCALE_WARN,
  STAGE_TIME_DANGER,
  STAGE_TIME_WARN,
  WANDERER_SPEED,
} from '../config/constants';

/**
 * Time-pressure speed multiplier: enemies move at normal speed until the stage
 * clock drops into the WARN window, then faster, then faster still in DANGER.
 * Applied by scaling the dt fed to every enemy system, so speeds stay pinned to
 * their configured values while covering proportionally more ground per tick.
 */
export function enemySpeedScale(state: GameState): number {
  const left = state.stageTimeLeft;
  if (left <= STAGE_TIME_DANGER) return ENEMY_SPEED_SCALE_DANGER;
  if (left <= STAGE_TIME_WARN) return ENEMY_SPEED_SCALE_WARN;
  return 1;
}

/** Sub-step cap (cells) so fast enemies cannot tunnel through 1-cell walls. */
const MAX_SUBSTEP = 0.4;

/** Enemies treat everything except UNCLAIMED as a wall (TRAIL included). */
function isOpen(grid: Grid, x: number, y: number): boolean {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  return inBounds(grid, cx, cy) && getCell(grid, cx, cy) === CellState.Unclaimed;
}

/**
 * Straight-line movement with axis-separated reflection. Mutates pos/vel.
 * Returns the indices of cells bumped into this update (trail-contact
 * detection for the spark system).
 */
export function bounceMove(grid: Grid, pos: Vec2, vel: Vec2, dt: number): number[] {
  const hits: number[] = [];
  const speed = Math.hypot(vel.x, vel.y);
  if (speed === 0) return hits;
  const steps = Math.max(1, Math.ceil((speed * dt) / MAX_SUBSTEP));
  const sdt = dt / steps;
  for (let i = 0; i < steps; i++) {
    const nx = pos.x + vel.x * sdt;
    if (isOpen(grid, nx, pos.y)) {
      pos.x = nx;
    } else {
      hits.push(Math.floor(pos.y) * grid.width + Math.floor(nx));
      vel.x = -vel.x;
    }
    const ny = pos.y + vel.y * sdt;
    if (isOpen(grid, pos.x, ny)) {
      pos.y = ny;
    } else {
      hits.push(Math.floor(ny) * grid.width + Math.floor(pos.x));
      vel.y = -vel.y;
    }
  }
  return hits;
}

/**
 * Boss (spec 2.4): bounces inside the unclaimed area; every reflection
 * perturbs the heading by a random angle within ±BOUNCE_JITTER_DEG while the
 * speed stays pinned to the stage config.
 */
export function updateBoss(state: GameState, dt: number): number[] {
  const boss = state.boss;
  if (!boss.alive) return [];
  const hits = bounceMove(state.grid, boss.pos, boss.vel, dt);
  if (hits.length > 0) {
    const jitter = ((state.rng() * 2 - 1) * BOUNCE_JITTER_DEG * Math.PI) / 180;
    const angle = Math.atan2(boss.vel.y, boss.vel.x) + jitter;
    boss.vel.x = Math.cos(angle) * state.stage.bossSpeed;
    boss.vel.y = Math.sin(angle) * state.stage.bossSpeed;
  }
  return hits;
}

function updateWanderer(state: GameState, m: WandererState, dt: number): number[] {
  const hits = bounceMove(state.grid, m.pos, m.vel, dt);
  if (hits.length > 0) {
    // keep the speed exact after reflections
    const speed = Math.hypot(m.vel.x, m.vel.y) || 1;
    m.vel.x = (m.vel.x / speed) * WANDERER_SPEED;
    m.vel.y = (m.vel.y / speed) * WANDERER_SPEED;
  }
  return hits;
}

const RIGHT_OF: Record<Direction, Direction> = { up: 'right', right: 'down', down: 'left', left: 'up' };
const LEFT_OF: Record<Direction, Direction> = { up: 'left', left: 'down', down: 'right', right: 'up' };
const BACK_OF: Record<Direction, Direction> = { up: 'down', down: 'up', left: 'right', right: 'left' };

/**
 * EdgeCrawler (spec 2.4): walks the boundary-cell graph (the same cells the
 * shielded player uses) with a wall-following turn preference, so it orbits
 * the claimed frontier clockwise (turn=1) or counter-clockwise (turn=-1).
 * Harmless to a shielded player; lethal to a drawing one (collision system).
 */
function stepCrawler(state: GameState, m: EdgeCrawlerState): void {
  const grid = state.grid;
  if (!isWalkable(grid, m.cell.x, m.cell.y)) {
    // a claim absorbed its cell into the interior — rejoin the frontier
    m.cell = nearestWalkable(grid, m.cell);
    return;
  }
  const order =
    m.turn === 1
      ? [RIGHT_OF[m.dir], m.dir, LEFT_OF[m.dir], BACK_OF[m.dir]]
      : [LEFT_OF[m.dir], m.dir, RIGHT_OF[m.dir], BACK_OF[m.dir]];
  for (const d of order) {
    const v = DIR_VECTORS[d];
    const nx = m.cell.x + v.x;
    const ny = m.cell.y + v.y;
    if (isWalkable(grid, nx, ny)) {
      m.cell = { x: nx, y: ny };
      m.dir = d;
      return;
    }
  }
}

function updateEdgeCrawler(state: GameState, m: EdgeCrawlerState, dt: number): number[] {
  m.stepCooldown -= dt;
  while (m.stepCooldown <= 0) {
    stepCrawler(state, m);
    m.stepCooldown += 1 / EDGE_CRAWLER_SPEED;
  }
  return [];
}

/**
 * Per-kind behavior table (OCP): adding an enemy type means adding a state
 * variant and one entry here — no engine-core changes.
 */
const MINION_BEHAVIORS: {
  [K in MinionState['kind']]: (
    state: GameState,
    m: Extract<MinionState, { kind: K }>,
    dt: number,
  ) => number[];
} = {
  wanderer: updateWanderer,
  edgeCrawler: updateEdgeCrawler,
};

export interface TrailContact {
  /** Trail cell index bumped into. */
  cellIdx: number;
  /** Owner of the contact cooldown timer. */
  source: { sparkCooldown: number };
}

/** Move boss + minions; report contacts with TRAIL cells for the spark system. */
export function updateEnemies(state: GameState, dt: number): TrailContact[] {
  const contacts: TrailContact[] = [];
  const collect = (hits: number[], source: { sparkCooldown: number }): void => {
    for (const idx of hits) {
      if (state.grid.cells[idx] === CellState.Trail) contacts.push({ cellIdx: idx, source });
    }
  };

  state.boss.sparkCooldown = Math.max(0, state.boss.sparkCooldown - dt);
  collect(updateBoss(state, dt), state.boss);

  for (const m of state.minions) {
    if (!m.alive) continue;
    if (m.frozenFor > 0) continue; // chain-lightning: frozen solid in place
    if (m.kind === 'wanderer') {
      m.sparkCooldown = Math.max(0, m.sparkCooldown - dt);
      collect(MINION_BEHAVIORS.wanderer(state, m, dt), m);
    } else {
      MINION_BEHAVIORS.edgeCrawler(state, m, dt);
    }
  }
  return contacts;
}
