import { useRef, useSyncExternalStore } from 'react';
import { createEngine } from '../../engine';
import type { Engine } from '../../engine';
import type { HudSnapshot } from '../../engine/core/types';

/**
 * The engine instance lives outside React (spec 3). React only subscribes to
 * the HUD snapshot, which the engine republishes solely on value changes, so
 * components re-render on score/lives/ratio updates — never per frame.
 */
export function useGameEngine(): { engine: Engine; snapshot: HudSnapshot } {
  const engineRef = useRef<Engine | null>(null);
  engineRef.current ??= createEngine();
  const engine = engineRef.current;
  const snapshot = useSyncExternalStore(engine.subscribe, engine.getSnapshot);
  return { engine, snapshot };
}
