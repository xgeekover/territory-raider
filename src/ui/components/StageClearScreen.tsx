import type { HudSnapshot } from '../../engine/core/types';

export function StageClearScreen({ snapshot }: { snapshot: HudSnapshot }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-zinc-950/85 font-mono">
      <p className="text-4xl font-bold tracking-[0.3em] text-emerald-300 drop-shadow-[0_0_18px_rgba(110,231,183,0.7)]">
        STAGE {snapshot.stage} CLEAR
      </p>
      <p className="text-sm text-zinc-300">
        CLAIMED <span className="text-lg text-cyan-300 tabular-nums">{snapshot.claimPct.toFixed(1)}%</span>
      </p>
      {!snapshot.bossAlive && (
        <p className="text-sm tracking-widest text-fuchsia-300">CORE DESTROYED — TOTAL ANNEXATION</p>
      )}
      <p className="text-sm text-zinc-300">
        BONUS <span className="text-lg text-fuchsia-300 tabular-nums">+{snapshot.lastClearBonus.toLocaleString('en-US')}</span>
      </p>
      <p className="text-sm text-zinc-300">
        SCORE <span className="text-lg text-cyan-300 tabular-nums">{snapshot.score.toLocaleString('en-US')}</span>
      </p>
      <p className="mt-2 animate-pulse text-xs text-zinc-400">PRESS ENTER FOR NEXT STAGE</p>
    </div>
  );
}
