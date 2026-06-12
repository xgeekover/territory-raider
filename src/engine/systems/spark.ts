import { cellIndex } from '../core/grid';
import type { GameState } from '../core/gameState';
import type { TrailContact } from './enemies';
import { SPARK_SPAWN_COOLDOWN } from '../config/constants';

/**
 * Spark spawning (spec 2.4): when the boss or a wanderer bumps a TRAIL cell,
 * a spark appears at that contact point. A per-enemy cooldown stops an enemy
 * grinding along the trail from emitting a spark every tick.
 */
export function spawnSparksFromContacts(state: GameState, contacts: TrailContact[]): void {
  for (const contact of contacts) {
    if (contact.source.sparkCooldown > 0) continue;
    const idx = state.trail.cells.findIndex(
      (cell) => cellIndex(state.grid, cell.x, cell.y) === contact.cellIdx,
    );
    if (idx < 0) continue;
    state.sparks.push({ trailIndex: idx });
    contact.source.sparkCooldown = SPARK_SPAWN_COOLDOWN;
  }
}

/**
 * Sparks run along the trail array toward the player (spec 2.4): the player
 * always rides the newest trail cell, so a spark chases the growing head
 * index at the stage's sparkSpeed. Reaching the player's cell is lethal.
 */
export function updateSparks(state: GameState, dt: number): void {
  if (state.player.mode !== 'drawing' || state.trail.cells.length === 0) return;
  const headIndex = state.trail.cells.length - 1;
  for (const spark of state.sparks) {
    spark.trailIndex = Math.min(spark.trailIndex + state.stage.sparkSpeed * dt, headIndex);
    if (spark.trailIndex >= headIndex && state.player.invincibleFor <= 0) {
      state.playerHit = true;
    }
  }
}
