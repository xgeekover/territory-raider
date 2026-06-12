import { HIGHSCORE_KEY } from '../engine/config/constants';

/** localStorage-backed high score; engine stays storage-agnostic. */
export function loadHighScore(): number {
  try {
    const raw = window.localStorage.getItem(HIGHSCORE_KEY);
    const n = raw === null ? 0 : Number(raw);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function saveHighScore(score: number): void {
  try {
    window.localStorage.setItem(HIGHSCORE_KEY, String(score));
  } catch {
    // storage unavailable (private mode etc.) — high score is best-effort
  }
}
