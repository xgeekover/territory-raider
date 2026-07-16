import { HIGHSCORE_KEY } from '../engine/config/constants';

/**
 * High-score persistence adapter.
 *
 * - Web build: localStorage (unchanged behaviour).
 * - Desktop build (Electron): the main process persists to a userData file via
 *   the `window.desktop` IPC bridge; localStorage is still written so the two
 *   stores stay in sync and the sync API keeps working during initial paint.
 *
 * The engine stays storage-agnostic; only this module knows where scores live.
 */

/** Synchronous localStorage read — used for the initial render on both targets. */
export function loadHighScore(): number {
  try {
    const raw = window.localStorage.getItem(HIGHSCORE_KEY);
    const n = raw === null ? 0 : Number(raw);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

/**
 * Resolve the authoritative high score after mount. On desktop this reads the
 * persisted userData file (survives cache clears); on web it mirrors localStorage.
 */
export async function initHighScore(): Promise<number> {
  const local = loadHighScore();
  if (window.desktop) {
    try {
      const persisted = await window.desktop.getHighScore();
      return Math.max(local, persisted);
    } catch {
      return local;
    }
  }
  return local;
}

/** Persist a new high score to every available store (best-effort). */
export function saveHighScore(score: number): void {
  try {
    window.localStorage.setItem(HIGHSCORE_KEY, String(score));
  } catch {
    // storage unavailable (private mode etc.) — high score is best-effort
  }
  // Fire-and-forget: the main process keeps the max, so races never regress.
  window.desktop?.setHighScore(score).catch(() => {});
}
