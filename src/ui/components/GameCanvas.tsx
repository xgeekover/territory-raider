import { useCallback, useEffect, useRef } from 'react';
import type { Engine } from '../../engine';
import { CELL_PX, FIXED_DT, GRID_HEIGHT, GRID_WIDTH, MAX_FRAME_DT } from '../../engine/config/constants';
import { createRenderer } from '../render/renderer';
import type { Renderer } from '../render/renderer';
import { PerfMonitor } from '../render/perf';
import { useKeyboard } from '../hooks/useKeyboard';
import { useRafLoop } from '../hooks/useRafLoop';
import { createFx } from '../fx/fx';
import type { Fx } from '../fx/fx';
import { createWatcher } from '../fx/watcher';
import type { Watcher } from '../fx/watcher';
import { audioSystem } from '../fx/audio';

/**
 * Owns the canvas, the fixed-timestep (60Hz) accumulator loop and keyboard
 * sampling. The frame delta is clamped so a backgrounded tab cannot produce a
 * huge dt and tunnel entities through walls (spec 3). In dev a debug overlay
 * shows live FPS and the static-layer redraw count (spec M6) — written via DOM
 * ref so it never triggers a React re-render.
 *
 * A second, pointer-transparent canvas stacked on top carries the juice layer
 * (particles/popups/flashes/vignette); a state-diffing watcher feeds it and
 * the synth audio system, so the engine itself stays event-free and untouched.
 * Screen shake translates the shared wrapper so both canvases move together.
 */
export function GameCanvas({ engine }: { engine: Engine }) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fxCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const debugRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const fxRef = useRef<Fx | null>(null);
  const watcherRef = useRef<Watcher | null>(null);
  const perfRef = useRef(new PerfMonitor());
  const accumulatorRef = useRef(0);
  const inputRef = useKeyboard(engine);

  useEffect(() => {
    if (canvasRef.current && !rendererRef.current) {
      rendererRef.current = createRenderer(canvasRef.current, engine.getState);
    }
    if (fxCanvasRef.current && !fxRef.current) {
      fxRef.current = createFx(fxCanvasRef.current);
      watcherRef.current = createWatcher();
    }
  }, [engine]);

  const runFrame = useCallback(
    (frameDt: number): void => {
      const renderer = rendererRef.current;
      const fx = fxRef.current;
      const watcher = watcherRef.current;
      if (!renderer || !fx || !watcher) return;

      let acc = accumulatorRef.current + Math.min(frameDt, MAX_FRAME_DT);
      while (acc >= FIXED_DT) {
        engine.tick(inputRef.current, FIXED_DT);
        acc -= FIXED_DT;
      }
      accumulatorRef.current = acc;

      watcher.scan(engine.getState(), fx, audioSystem, frameDt);
      fx.update(frameDt);

      const now = performance.now();
      renderer.drawFrame(now);
      fx.draw(now);

      if (wrapRef.current) {
        const { x, y } = fx.getOffset();
        wrapRef.current.style.transform = x || y ? `translate(${x}px, ${y}px)` : '';
      }

      const fps = perfRef.current.tick(frameDt);
      if (import.meta.env.DEV && debugRef.current) {
        debugRef.current.textContent = `${fps} fps · static redraws ${renderer.getStaticRedrawCount()}`;
      }
    },
    [engine, inputRef],
  );

  useRafLoop(runFrame);

  // DEV-only manual frame pump: advance + redraw one frame from the console.
  // Lets QA/tools step the game when rAF is paused (e.g. a hidden tab). Absent
  // from production builds.
  useEffect(() => {
    if (!import.meta.env.DEV || typeof window === 'undefined') return;
    (window as unknown as { __step?: (dt: number) => void }).__step = runFrame;
    return () => {
      delete (window as unknown as { __step?: (dt: number) => void }).__step;
    };
  }, [runFrame]);

  return (
    <div ref={wrapRef} className="relative">
      <canvas
        ref={canvasRef}
        width={GRID_WIDTH * CELL_PX}
        height={GRID_HEIGHT * CELL_PX}
        className="block rounded-sm shadow-[0_0_40px_rgba(34,211,238,0.15)]"
      />
      <canvas
        ref={fxCanvasRef}
        width={GRID_WIDTH * CELL_PX}
        height={GRID_HEIGHT * CELL_PX}
        className="pointer-events-none absolute left-0 top-0"
      />
      {import.meta.env.DEV && (
        <div
          ref={debugRef}
          className="pointer-events-none absolute right-2 top-2 rounded bg-zinc-900/70 px-2 py-0.5 font-mono text-[10px] text-emerald-300"
        />
      )}
    </div>
  );
}
