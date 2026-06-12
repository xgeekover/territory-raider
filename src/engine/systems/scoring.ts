import type { GameState } from '../core/gameState';
import {
  BIG_CLAIM_MULTIPLIER,
  BIG_CLAIM_RATIO,
  CELL_SCORE,
  CLEAR_RATIO,
  OVERCLEAR_BONUS_PER_PERCENT,
  TRAP_BONUS,
} from '../config/constants';

/** Spec 2.7: cells x10, doubled when one closure takes >=15% of the interior. */
export function applyClaimScore(state: GameState, cellsClaimed: number): number {
  let points = cellsClaimed * CELL_SCORE;
  if (cellsClaimed >= state.grid.interiorCells * BIG_CLAIM_RATIO) {
    points *= BIG_CLAIM_MULTIPLIER;
  }
  state.score += points;
  return points;
}

/** Spec 2.7: 1,000 points per minion destroyed by being enclosed. */
export function applyTrapBonus(state: GameState, trappedCount: number): void {
  state.score += trappedCount * TRAP_BONUS;
}

/**
 * Spec 2.7: the stage clears at 80%+; every percentage point above the target
 * is worth 1,000 points. Returns true when the stage was cleared.
 */
export function checkStageClear(state: GameState): boolean {
  if (state.claimRatio < CLEAR_RATIO) return false;
  const overPercent = state.claimRatio * 100 - CLEAR_RATIO * 100;
  const bonus = Math.round(overPercent * OVERCLEAR_BONUS_PER_PERCENT);
  state.lastClearBonus = bonus;
  state.score += bonus;
  state.status = 'stageClear';
  return true;
}
