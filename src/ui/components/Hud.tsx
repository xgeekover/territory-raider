import type { HudSnapshot } from '../../engine/core/types';
import { CLEAR_RATIO } from '../../engine/config/constants';

function LivesDots({ lives }: { lives: number }) {
  return (
    <span className="flex gap-1" aria-label={`${lives} lives`}>
      {Array.from({ length: Math.max(lives, 0) }, (_, i) => (
        <span key={i} className="inline-block h-2.5 w-2.5 rotate-45 bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.8)]" />
      ))}
    </span>
  );
}

export function Hud({ snapshot, highScore }: { snapshot: HudSnapshot; highScore: number }) {
  const target = Math.round(CLEAR_RATIO * 100);
  return (
    <div className="flex w-full items-center justify-between gap-6 px-1 font-mono text-sm text-zinc-300">
      <div className="flex items-baseline gap-2">
        <span className="text-xs uppercase tracking-widest text-zinc-500">Score</span>
        <span className="min-w-[7ch] text-lg text-cyan-300 tabular-nums">{snapshot.score.toLocaleString('en-US')}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-xs uppercase tracking-widest text-zinc-500">Hi</span>
        <span className="tabular-nums text-zinc-400">{highScore.toLocaleString('en-US')}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-xs uppercase tracking-widest text-zinc-500">Stage</span>
        <span className="tabular-nums text-fuchsia-300">{snapshot.stage}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-xs uppercase tracking-widest text-zinc-500">Claimed</span>
        <span className={`tabular-nums ${snapshot.claimPct >= target ? 'text-emerald-300' : 'text-cyan-300'}`}>
          {snapshot.claimPct.toFixed(1)}%
        </span>
        <span className="text-xs text-zinc-600">/ {target}%</span>
      </div>
      <div className="flex items-center gap-2">
        {snapshot.laserAmmo > 0 && (
          <span className="rounded border border-cyan-700 px-1.5 py-0.5 text-xs text-cyan-300">
            LASER ×{snapshot.laserAmmo}
          </span>
        )}
        {snapshot.timeStopFor > 0 && (
          <span className="rounded border border-amber-600 px-1.5 py-0.5 text-xs text-amber-300">
            FREEZE {snapshot.timeStopFor.toFixed(1)}s
          </span>
        )}
        {snapshot.speedBoost && (
          <span className="rounded border border-fuchsia-700 px-1.5 py-0.5 text-xs text-fuchsia-300">SPEED</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs uppercase tracking-widest text-zinc-500">Lives</span>
        <LivesDots lives={snapshot.lives} />
      </div>
    </div>
  );
}
