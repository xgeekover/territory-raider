/**
 * Ambient contract for the Electron preload bridge exposed on `window.desktop`.
 * Present only in the desktop build; the web build leaves `window.desktop`
 * undefined and the high-score adapter falls back to localStorage.
 */
interface DesktopBridge {
  /** Always true when running inside the Electron shell. */
  readonly isDesktop: true;
  /** Read the persisted high score from the user-data file. */
  getHighScore(): Promise<number>;
  /** Persist a new high score (best-effort, keeps the max). Resolves to the stored value. */
  setHighScore(score: number): Promise<number>;
}

interface Window {
  desktop?: DesktopBridge;
}
