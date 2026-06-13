import { useEffect, useRef } from 'react';
import type { Engine } from '../../engine';
import { CELL_PX, FIXED_DT, GRID_HEIGHT, GRID_WIDTH, MAX_FRAME_DT } from '../../engine/config/constants';
import { createRenderer } from '../render/renderer';
import type { Renderer } from '../render/renderer';
import { PerfMonitor } from '../render/perf';
import { useKeyboard } from '../hooks/useKeyboard';
import { useRafLoop } from '../hooks/useRafLoop';

/**
 * Owns the canvas, the fixed-timestep (60Hz) accumulator loop and keyboard
 * sampling. The frame delta is clamped so a backgrounded tab cannot produce a
 * huge dt and tunnel entities through walls (spec 3). In dev a debug overlay
 * shows live FPS and the static-layer redraw count (spec M6) — written via DOM
 * ref so it never triggers a React re-render.
 */
export function GameCanvas({ engine }: { engine: Engine }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const debugRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const perfRef = useRef(new PerfMonitor());
  const accumulatorRef = useRef(0);
  const inputRef = useKeyboard(engine);

  useEffect(() => {
    if (canvasRef.current && !rendererRef.current) {
      rendererRef.current = createRenderer(canvasRef.current, engine.getState);
    }
  }, [engine]);

  useRafLoop((frameDt) => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    let acc = accumulatorRef.current + Math.min(frameDt, MAX_FRAME_DT);
    while (acc >= FIXED_DT) {
      engine.tick(inputRef.current, FIXED_DT);
      acc -= FIXED_DT;
    }
    accumulatorRef.current = acc;
    renderer.drawFrame(performance.now());

    const fps = perfRef.current.tick(frameDt);
    if (import.meta.env.DEV && debugRef.current) {
      debugRef.current.textContent = `${fps} fps · static redraws ${renderer.getStaticRedrawCount()}`;
    }
  });

  return (
    <>
      <canvas
        ref={canvasRef}
        width={GRID_WIDTH * CELL_PX}
        height={GRID_HEIGHT * CELL_PX}
        className="block rounded-sm shadow-[0_0_40px_rgba(34,211,238,0.15)]"
      />
      {import.meta.env.DEV && (
        <div
          ref={debugRef}
          className="pointer-events-none absolute right-2 top-2 rounded bg-zinc-900/70 px-2 py-0.5 font-mono text-[10px] text-emerald-300"
        />
      )}
    </>
  );
}
