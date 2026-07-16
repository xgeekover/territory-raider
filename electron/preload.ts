/**
 * Preload — the only bridge between the sandboxed renderer and the main
 * process. Runs with contextIsolation, so nothing here leaks into the page
 * except the explicit `window.desktop` surface below. No Node globals are
 * exposed to the renderer; every capability goes through a named IPC channel.
 */
import { contextBridge, ipcRenderer } from 'electron';

const bridge = {
  isDesktop: true as const,
  getHighScore: (): Promise<number> => ipcRenderer.invoke('highscore:get'),
  setHighScore: (score: number): Promise<number> =>
    ipcRenderer.invoke('highscore:set', score),
};

contextBridge.exposeInMainWorld('desktop', bridge);
