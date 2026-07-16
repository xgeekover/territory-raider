import { useEffect, useState } from 'react';
import type { HudSnapshot } from '../../engine/core/types';
import { Confetti } from './Confetti';

/** Counts 0 → value over ~0.7s for a satisfying bonus reveal. */
function useCountUp(value: number): number {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (value <= 0) {
      setShown(0);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const durMs = 700;
    const step = (now: number): void => {
      const k = Math.min(1, (now - t0) / durMs);
      setShown(Math.round(value * (1 - Math.pow(1 - k, 3)))); // ease-out cubic
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return shown;
}

export function StageClearScreen({ snapshot }: { snapshot: HudSnapshot }) {
  const bonus = useCountUp(snapshot.lastClearBonus);
  return (
    <div className="overlay-in absolute inset-0 flex flex-col items-center justify-center gap-4 bg-zinc-950/85 font-mono">
      <Confetti count={28} />
      <p className="text-4xl font-bold tracking-[0.3em] text-emerald-300 drop-shadow-[0_0_18px_rgba(110,231,183,0.7)]">
        STAGE {snapshot.stage} CLEAR
      </p>
      <p className="text-sm text-zinc-300">
        CLAIMED <span className="text-lg text-cyan-300 tabular-nums">{snapshot.claimPct.toFixed(1)}%</span>
      </p>
      {!snapshot.bossAlive && (
        <p className="animate-pulse text-sm tracking-widest text-fuchsia-300">
          ◆ CORE DESTROYED — TOTAL ANNEXATION ◆
        </p>
      )}
      <p className="text-sm text-zinc-300">
        BONUS{' '}
        <span className="text-lg text-fuchsia-300 tabular-nums">+{bonus.toLocaleString('en-US')}</span>
      </p>
      <p className="text-sm text-zinc-300">
        SCORE <span className="text-lg text-cyan-300 tabular-nums">{snapshot.score.toLocaleString('en-US')}</span>
      </p>
      <p className="mt-2 animate-pulse text-xs text-zinc-400">PRESS ENTER FOR NEXT STAGE</p>
    </div>
  );
}
