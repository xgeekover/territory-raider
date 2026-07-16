import { useEffect, useState } from 'react';
import type { RefObject } from 'react';

/**
 * Scale-to-fit for a fixed-size layout: returns the CSS scale factor that fits
 * the element's *natural* (untransformed) size inside the viewport, with a
 * small breathing margin. The canvas keeps its internal 768×576 resolution —
 * only the presentation scales, so the simulation and hit-grid are unaffected.
 */
export function useFitScale(ref: RefObject<HTMLElement | null>): number {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const compute = (): void => {
      // offsetWidth/Height ignore CSS transforms — always the design size.
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      if (!w || !h) return;
      const k = Math.min(window.innerWidth / w, window.innerHeight / h) * 0.97;
      setScale(Math.max(0.3, k));
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, [ref]);

  return scale;
}
