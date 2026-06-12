import { useEffect, useRef } from 'react';
import type { Engine } from '../../engine';
import { CELL_PX, FIXED_DT, GRID_HEIGHT, GRID_WIDTH, MAX_FRAME_DT } from '../../engine/config/constants';
import { createRenderer } from '../render/renderer';
import type { Renderer } from '../render/renderer';
import { useKeyboard } from '../hooks/useKeyboard';
import { useRafLoop } from '../hooks/useRafLoop';

/**
 * Owns the canvas, the fixed-timestep (60Hz) accumulator loop and keyboard
 * sampling. The frame delta is clamped so a backgrounded tab cannot produce a
 * huge dt and tunnel entities through walls (spec 3).
 */
export function GameCanvas({ engine }: { engine: Engine }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
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
  });

  return (
    <canvas
      ref={canvasRef}
      width={GRID_WIDTH * CELL_PX}
      height={GRID_HEIGHT * CELL_PX}
      className="block rounded-sm shadow-[0_0_40px_rgba(34,211,238,0.15)]"
    />
  );
}
