import { CellState, DIR_VECTORS } from '../core/types';
import type { Direction } from '../core/types';
import { getCell, inBounds } from '../core/grid';
import type { GameState } from '../core/gameState';
import { claimAllRemaining } from './claim';
import {
  BOSS_KILL_BONUS,
  LASER_HIT_BOSS_DIST,
  LASER_HIT_MINION_DIST,
  LASER_SPEED,
} from '../config/constants';

const SUBSTEP = 0.5; // cells per collision sample

/**
 * Fire direction (spec 2.6 'L'): the laser leaves the shielded player toward
 * the unclaimed area — the facing direction when it points into open space,
 * otherwise the first open 4-direction.
 */
function chooseFireDirection(state: GameState): Direction | null {
  const { player, grid } = state;
  const candidates: Direction[] = [player.facing, 'up', 'down', 'left', 'right'];
  for (const dir of candidates) {
    const v = DIR_VECTORS[dir];
    const nx = player.pos.x + v.x;
    const ny = player.pos.y + v.y;
    if (inBounds(grid, nx, ny) && getCell(grid, nx, ny) === CellState.Unclaimed) {
      return dir;
    }
  }
  return null;
}

/** Spend one charge and spawn a shot. Only a shielded player can fire. */
export function fireLaser(state: GameState): boolean {
  if (state.status !== 'playing') return false;
  if (state.player.mode !== 'shield') return false;
  if (state.laserAmmo <= 0) return false;
  const dir = chooseFireDirection(state);
  if (dir === null) return false;
  state.laserAmmo--;
  state.lasers.push({
    pos: { x: state.player.pos.x + 0.5, y: state.player.pos.y + 0.5 },
    dir,
  });
  return true;
}

function killBoss(state: GameState): void {
  state.boss.alive = false;
  state.boss.hp = 0;
  state.score += BOSS_KILL_BONUS;
  state.bossKillClear = true;
  // No flood-fill seed left: the whole field is claimed and the stage clears
  // immediately with the big bonus (spec 2.3 / 2.7).
  claimAllRemaining(state);
}

/**
 * Shots travel through unclaimed space, die against claimed/border cells, and
 * damage the first enemy in their path: minions die instantly, the boss loses
 * 1 HP per hit (spec 2.6).
 */
export function updateLasers(state: GameState, dt: number): void {
  if (state.lasers.length === 0) return;
  const survivors: typeof state.lasers = [];

  for (const shot of state.lasers) {
    const v = DIR_VECTORS[shot.dir];
    const distance = LASER_SPEED * dt;
    const steps = Math.max(1, Math.ceil(distance / SUBSTEP));
    const stepLen = distance / steps;
    let dead = false;

    for (let i = 0; i < steps && !dead; i++) {
      shot.pos.x += v.x * stepLen;
      shot.pos.y += v.y * stepLen;
      const cx = Math.floor(shot.pos.x);
      const cy = Math.floor(shot.pos.y);
      if (!inBounds(state.grid, cx, cy)) {
        dead = true;
        break;
      }
      const cell = getCell(state.grid, cx, cy);
      if (cell === CellState.Claimed || cell === CellState.Border) {
        dead = true; // dissipates against the frontier
        break;
      }

      const boss = state.boss;
      if (boss.alive && hitTest(shot.pos.x, shot.pos.y, boss.pos.x, boss.pos.y, LASER_HIT_BOSS_DIST)) {
        boss.hp--;
        dead = true;
        if (boss.hp <= 0) killBoss(state);
        break;
      }
      for (const m of state.minions) {
        if (!m.alive) continue;
        const mx = m.kind === 'wanderer' ? m.pos.x : m.cell.x + 0.5;
        const my = m.kind === 'wanderer' ? m.pos.y : m.cell.y + 0.5;
        if (hitTest(shot.pos.x, shot.pos.y, mx, my, LASER_HIT_MINION_DIST)) {
          m.alive = false; // minions die in one hit
          dead = true;
          break;
        }
      }
    }
    if (!dead) survivors.push(shot);
  }
  state.lasers = survivors;
}

function hitTest(ax: number, ay: number, bx: number, by: number, dist: number): boolean {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy < dist * dist;
}
