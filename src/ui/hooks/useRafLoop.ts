import { useEffect, useRef } from 'react';

/**
 * requestAnimationFrame loop; the callback receives the raw frame delta in
 * seconds. Callers run their own fixed-timestep accumulator on top.
 */
export function useRafLoop(callback: (frameDt: number) => void): void {
  const cbRef = useRef(callback);
  cbRef.current = callback;

  useEffect(() => {
    let rafId = 0;
    let last = performance.now();
    const frame = (now: number): void => {
      const dt = (now - last) / 1000;
      last = now;
      cbRef.current(dt);
      rafId = requestAnimationFrame(frame);
    };
    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, []);
}
