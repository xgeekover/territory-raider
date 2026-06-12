import { CellState } from '../core/types';
import type { ItemCode } from '../core/types';
import { getCell } from '../core/grid';
import type { GameState } from '../core/gameState';
import {
  ITEM_POINTS,
  LASER_CHARGES,
  SPEED_BOOST_MULT,
  TIME_STOP_DURATION,
} from '../config/constants';

/** Item effects (spec 2.6); all tuning lives in constants.ts. */
export function applyItemEffect(state: GameState, code: ItemCode): void {
  switch (code) {
    case 'T': // Time Stop: every enemy (and spark) freezes
      state.timeStopFor = TIME_STOP_DURATION;
      break;
    case 'S': // Speed Up: lasts for the rest of the stage
      state.player.speedMultiplier = SPEED_BOOST_MULT;
      break;
    case 'L': // Laser: 5 charges
      state.laserAmmo += LASER_CHARGES;
      break;
    case 'P': // Points
      state.score += ITEM_POINTS;
      break;
    case 'C': // Clear: destroy every minion on screen
      for (const m of state.minions) m.alive = false;
      break;
  }
}

/**
 * Items whose tile just became claimed are auto-acquired exactly once
 * (spec 2.6); the `collected` flag guards re-acquisition on later closures.
 */
export function collectClaimedItems(state: GameState): ItemCode[] {
  const collected: ItemCode[] = [];
  for (const item of state.items) {
    if (item.collected) continue;
    if (getCell(state.grid, item.cell.x, item.cell.y) !== CellState.Claimed) continue;
    item.collected = true;
    applyItemEffect(state, item.code);
    collected.push(item.code);
  }
  return collected;
}
