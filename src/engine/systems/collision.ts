import type { GameState } from '../core/gameState';
import { rollbackTrail } from './claim';
import {
  BOSS_CONTACT_DIST,
  CRAWLER_CONTACT_DIST,
  RESPAWN_INVINCIBILITY,
  WANDERER_CONTACT_DIST,
} from '../config/constants';

function within(ax: number, ay: number, bx: number, by: number, dist: number): boolean {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy < dist * dist;
}

/**
 * Enemy-body contact (spec 2.4): only a DRAWING player can die; the shield
 * state is fully invulnerable. All checks are constant-time per enemy against
 * the player's cell center — no entity-pair scans.
 */
export function updatePlayerCollisions(state: GameState): void {
  const p = state.player;
  if (p.mode !== 'drawing' || p.invincibleFor > 0) return;
  const px = p.pos.x + 0.5;
  const py = p.pos.y + 0.5;

  if (state.boss.alive && within(state.boss.pos.x, state.boss.pos.y, px, py, BOSS_CONTACT_DIST)) {
    state.playerHit = true;
    return;
  }
  for (const m of state.minions) {
    if (!m.alive) continue;
    const hit =
      m.kind === 'wanderer'
        ? within(m.pos.x, m.pos.y, px, py, WANDERER_CONTACT_DIST)
        : within(m.cell.x + 0.5, m.cell.y + 0.5, px, py, CRAWLER_CONTACT_DIST);
    if (hit) {
      state.playerHit = true;
      return;
    }
  }
}

/**
 * Death (spec 2.5): lose a life, roll the whole trail back to UNCLAIMED
 * (ratio unchanged), clear sparks, respawn at the trail start cell with 2s of
 * blinking invincibility. Zero lives ends the game.
 */
export function applyDeath(state: GameState): void {
  state.playerHit = false;
  state.lives -= 1;
  const respawn = state.trail.startCell ?? state.player.pos;
  rollbackTrail(state); // restores UNCLAIMED, clears sparks, shield mode
  state.player.pos = { ...respawn };
  state.player.moveCooldown = 0;
  state.player.invincibleFor = RESPAWN_INVINCIBILITY;
  if (state.lives <= 0) {
    state.status = 'gameOver';
  }
}
