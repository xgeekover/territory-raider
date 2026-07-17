import { CellState } from '../core/types';
import type { BossProjectile } from '../core/types';
import { getCell, inBounds } from '../core/grid';
import type { GameState } from '../core/gameState';
import {
  BOSS_FIRE_COOLDOWN,
  BOSS_RAGE1_RATIO,
  BOSS_RAGE2_RATIO,
  BOSS_RAGE_COOLDOWN_MULT,
  PROJECTILE_CONTACT_DIST,
  PROJECTILE_FAN_RAD,
  PROJECTILE_SPEED,
} from '../config/constants';

/**
 * Boss battle: the Core fights back.
 *
 * The boss fires player-aimed projectile volleys on a cooldown. Claiming
 * territory enrages it — the fight escalates precisely because you are
 * winning, which is the genre's core tension:
 *
 *   rage 0  (< 40% claimed)  slow single aimed shots
 *   rage 1  (≥ 40%)          ~1.6× fire rate
 *   rage 2  (≥ 65%)          ~2.4× fire rate + 3-shot fan
 *
 * Projectiles exist in unclaimed space only (they splash on claimed/border
 * cells — your territory is literally cover) and, like every enemy, can only
 * kill a DRAWING player. Time Stop freezes the whole system (the engine gates
 * this update alongside enemies/sparks).
 */

let nextProjectileId = 1;

/**
 * Rage tier from claim progress; drives fire rate, volley shape and the HUD.
 * Only boss-battle stages enrage — elsewhere the Core stays calm (rage 0).
 */
export function bossRageLevel(state: GameState): 0 | 1 | 2 {
  if (!state.stage.bossBattle) return 0;
  if (state.claimRatio >= BOSS_RAGE2_RATIO) return 2;
  if (state.claimRatio >= BOSS_RAGE1_RATIO) return 1;
  return 0;
}

function fireVolley(state: GameState, rage: 0 | 1 | 2): void {
  const speed = state.stage.projectileSpeed ?? PROJECTILE_SPEED;
  const b = state.boss;
  const px = state.player.pos.x + 0.5;
  const py = state.player.pos.y + 0.5;
  const aim = Math.atan2(py - b.pos.y, px - b.pos.x);
  // Rage 2 fans three shots; below that a single aimed shot.
  const angles =
    rage === 2 ? [aim - PROJECTILE_FAN_RAD, aim, aim + PROJECTILE_FAN_RAD] : [aim];
  for (const a of angles) {
    const shot: BossProjectile = {
      id: nextProjectileId++,
      pos: { x: b.pos.x, y: b.pos.y },
      vel: { x: Math.cos(a) * speed, y: Math.sin(a) * speed },
    };
    state.projectiles.push(shot);
  }
}

/**
 * Advance the boss's firing cooldown and every projectile in flight.
 * Must run inside the engine's Time-Stop gate (same block as enemies).
 */
export function updateBossAttack(state: GameState, dt: number): void {
  // --- firing (boss-battle stages only) -------------------------------------
  if (state.stage.bossBattle && state.boss.alive) {
    const rage = bossRageLevel(state);
    state.boss.fireCooldown -= dt;
    if (state.boss.fireCooldown <= 0) {
      fireVolley(state, rage);
      const base = state.stage.bossFireCooldown ?? BOSS_FIRE_COOLDOWN;
      state.boss.fireCooldown = base * BOSS_RAGE_COOLDOWN_MULT[rage];
    }
  }

  // --- flight, splash and player contact -------------------------------------
  if (state.projectiles.length === 0) return;
  const p = state.player;
  const canHitPlayer = p.mode === 'drawing' && p.invincibleFor <= 0;
  const px = p.pos.x + 0.5;
  const py = p.pos.y + 0.5;

  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    const shot = state.projectiles[i]!;
    shot.pos.x += shot.vel.x * dt;
    shot.pos.y += shot.vel.y * dt;

    const cx = Math.floor(shot.pos.x);
    const cy = Math.floor(shot.pos.y);
    // Out of bounds, or reached solid ground: the frontier is cover.
    if (!inBounds(state.grid, cx, cy)) {
      state.projectiles.splice(i, 1);
      continue;
    }
    const cell = getCell(state.grid, cx, cy);
    if (cell === CellState.Claimed || cell === CellState.Border || cell === CellState.Obstacle) {
      state.projectiles.splice(i, 1); // rocks are cover too
      continue;
    }

    if (canHitPlayer) {
      const dx = shot.pos.x - px;
      const dy = shot.pos.y - py;
      if (dx * dx + dy * dy < PROJECTILE_CONTACT_DIST * PROJECTILE_CONTACT_DIST) {
        state.playerHit = true;
        state.projectiles.splice(i, 1);
      }
    }
  }
}
