import { useRef, useSyncExternalStore } from 'react';
import { createEngine } from '../../engine';
import type { Engine } from '../../engine';
import type { HudSnapshot } from '../../engine/core/types';

/**
 * The engine instance lives outside React (spec 3). React only subscribes to
 * the HUD snapshot, which the engine republishes solely on value changes, so
 * components re-render on score/lives/ratio updates — never per frame.
 */
/**
 * DEV-only stage select for QA of the long campaign: `?stage=N` (or `#stage=N`)
 * jumps straight into stage N. Stripped from production builds.
 */
function devStageOptions(): { stageIndex: number; startPlaying: true } | null {
  if (!import.meta.env.DEV || typeof window === 'undefined') return null;
  const m = /stage=(\d+)/.exec(window.location.search + window.location.hash);
  if (!m) return null;
  const n = Math.max(1, parseInt(m[1]!, 10));
  return { stageIndex: n - 1, startPlaying: true };
}

export function useGameEngine(): { engine: Engine; snapshot: HudSnapshot } {
  const engineRef = useRef<Engine | null>(null);
  engineRef.current ??= createEngine(devStageOptions() ?? {});
  const engine = engineRef.current;
  // DEV-only handle for QA/debugging from the console (e.g. inspecting or
  // fast-forwarding the stage clock). Never present in production builds.
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    (window as unknown as { __game?: Engine }).__game = engine;
  }
  const snapshot = useSyncExternalStore(engine.subscribe, engine.getSnapshot);
  return { engine, snapshot };
}
