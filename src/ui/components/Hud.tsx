import type { HudSnapshot } from '../../engine/core/types';
import {
  CLEAR_RATIO,
  STAGE_TIME_DANGER,
  STAGE_TIME_LIMIT,
  STAGE_TIME_WARN,
} from '../../engine/config/constants';

/** Compact score formatting so huge late-game numbers can't wrap the HUD:
 *  under a million stays exact, beyond it collapses to e.g. "4.47M". */
function fmtScore(n: number): string {
  if (n < 1_000_000) return n.toLocaleString('en-US');
  const m = n / 1_000_000;
  return `${m >= 100 ? Math.round(m) : m.toFixed(2).replace(/\.?0+$/, '')}M`;
}

function LivesDots({ lives }: { lives: number }) {
  const critical = lives === 1;
  return (
    <span className="flex gap-1" aria-label={`${lives} lives`}>
      {Array.from({ length: Math.max(lives, 0) }, (_, i) => (
        <span
          key={i}
          className={
            critical
              ? 'inline-block h-2 w-2 rotate-45 animate-pulse bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.9)]'
              : 'inline-block h-2 w-2 rotate-45 bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.8)]'
          }
        />
      ))}
    </span>
  );
}

/** Boss health: CORE label + hp pips, hotter as the rage tier climbs. */
function BossBar({ hp, hpMax, rage }: { hp: number; hpMax: number; rage: number }) {
  const color =
    rage >= 2
      ? 'bg-rose-400 shadow-[0_0_6px_rgba(251,113,133,0.9)]'
      : rage === 1
        ? 'bg-orange-400 shadow-[0_0_6px_rgba(251,146,60,0.9)]'
        : 'bg-fuchsia-400 shadow-[0_0_6px_rgba(232,121,249,0.8)]';
  return (
    <div className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
      <span className={`text-[10px] uppercase tracking-widest ${rage >= 2 ? 'animate-pulse text-rose-400' : 'text-zinc-500'}`}>
        {rage >= 2 ? 'Fury' : rage === 1 ? 'Rage' : 'Core'}
      </span>
      <span className="flex gap-0.5" aria-label={`boss ${hp}/${hpMax}`}>
        {Array.from({ length: hpMax }, (_, i) => (
          <span key={i} className={`inline-block h-2 w-1 ${i < hp ? color : 'bg-zinc-800'}`} />
        ))}
      </span>
    </div>
  );
}

/** Stage countdown. Calm cyan, then amber in the WARN window, then a pulsing
 *  red in DANGER — the same thresholds at which enemies speed up. */
function TimeGauge({ seconds }: { seconds: number }) {
  const danger = seconds <= STAGE_TIME_DANGER;
  const warn = seconds <= STAGE_TIME_WARN;
  const color = danger ? 'text-rose-400' : warn ? 'text-amber-300' : 'text-cyan-300';
  const pct = Math.max(0, Math.min(100, (seconds / STAGE_TIME_LIMIT) * 100));
  const barColor = danger
    ? 'bg-rose-400 shadow-[0_0_6px_rgba(251,113,133,0.9)]'
    : warn
      ? 'bg-amber-300 shadow-[0_0_6px_rgba(252,211,77,0.8)]'
      : 'bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.7)]';
  return (
    <div className="flex shrink-0 items-center gap-1.5 whitespace-nowrap" aria-label={`${seconds} seconds left`}>
      <span className="text-[10px] uppercase tracking-widest text-zinc-500">Time</span>
      <span className={`min-w-[2ch] text-right text-sm tabular-nums ${color} ${danger ? 'animate-pulse' : ''}`}>
        {seconds}
      </span>
      <span className="relative h-1 w-10 overflow-hidden rounded bg-zinc-800">
        <span
          className={`absolute inset-y-0 left-0 rounded transition-[width] duration-300 ease-linear ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </span>
    </div>
  );
}

/** Slim claim-progress bar with a glowing tick at the 80% clear target. */
function ClaimBar({ pct, target }: { pct: number; target: number }) {
  const reached = pct >= target;
  return (
    <div className="relative mt-1 h-1 w-full overflow-visible rounded bg-zinc-800">
      <div
        className={`h-full rounded transition-[width] duration-300 ease-out ${
          reached
            ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
            : 'bg-gradient-to-r from-cyan-500 to-cyan-300 shadow-[0_0_6px_rgba(34,211,238,0.6)]'
        }`}
        style={{ width: `${Math.min(100, pct)}%` }}
      />
      <div
        className={`absolute top-1/2 h-2.5 w-0.5 -translate-y-1/2 ${
          reached ? 'bg-emerald-300' : 'bg-zinc-500'
        }`}
        style={{ left: `${target}%` }}
        aria-label={`${target}% target`}
      />
    </div>
  );
}

/**
 * Single-line HUD: every segment is shrink-0 + nowrap and the values use
 * compact formats, so the row always fits the 768px playfield width without
 * wrapping — transient status badges included.
 */
export function Hud({ snapshot, highScore }: { snapshot: HudSnapshot; highScore: number }) {
  const target = Math.round(CLEAR_RATIO * 100);
  return (
    <div className="w-full px-1 font-mono text-xs text-zinc-300">
      <div className="flex w-full items-center justify-between gap-3">
        <div className="flex shrink-0 items-baseline gap-1.5 whitespace-nowrap">
          <span className="text-[10px] uppercase tracking-widest text-zinc-500">Score</span>
          {/* key restarts the pop animation on every score change */}
          <span
            key={snapshot.score}
            className="score-pop min-w-[6ch] text-base text-cyan-300 tabular-nums"
          >
            {fmtScore(snapshot.score)}
          </span>
        </div>
        <div className="flex shrink-0 items-baseline gap-1.5 whitespace-nowrap">
          <span className="text-[10px] uppercase tracking-widest text-zinc-500">Hi</span>
          <span className="tabular-nums text-zinc-400">{fmtScore(highScore)}</span>
        </div>
        <div className="flex shrink-0 items-baseline gap-1.5 whitespace-nowrap">
          <span className="text-[10px] uppercase tracking-widest text-zinc-500">Stage</span>
          <span className="tabular-nums text-fuchsia-300">{snapshot.stage}</span>
        </div>
        <TimeGauge seconds={snapshot.stageTimeLeft} />
        {snapshot.bossAlive && (
          <BossBar hp={snapshot.bossHp} hpMax={snapshot.bossHpMax} rage={snapshot.bossRage} />
        )}
        <div className="flex shrink-0 items-baseline gap-1.5 whitespace-nowrap">
          <span className="text-[10px] uppercase tracking-widest text-zinc-500">Claimed</span>
          <span className={`tabular-nums ${snapshot.claimPct >= target ? 'text-emerald-300' : 'text-cyan-300'}`}>
            {snapshot.claimPct.toFixed(1)}
          </span>
          <span className="text-[10px] text-zinc-600">/{target}%</span>
        </div>
        <div className="flex shrink-0 items-center gap-1 whitespace-nowrap empty:hidden">
          {snapshot.laserAmmo > 0 && (
            <span className="rounded border border-cyan-700 px-1 text-[10px] leading-4 text-cyan-300">
              L×{snapshot.laserAmmo}
            </span>
          )}
          {snapshot.timeStopFor > 0 && (
            <span className="animate-pulse rounded border border-amber-600 px-1 text-[10px] leading-4 text-amber-300">
              FRZ {snapshot.timeStopFor.toFixed(1)}
            </span>
          )}
          {snapshot.stunnedFor > 0 && (
            <span className="animate-pulse rounded border border-yellow-500 px-1 text-[10px] leading-4 text-yellow-300">
              ⚡STUN
            </span>
          )}
          {snapshot.stunnedFor <= 0 && snapshot.slowedFor > 0 && (
            <span className="rounded border border-sky-600 px-1 text-[10px] leading-4 text-sky-300">
              ❄{snapshot.slowedFor.toFixed(1)}
            </span>
          )}
          {snapshot.speedBoost && (
            <span className="rounded border border-fuchsia-700 px-1 text-[10px] leading-4 text-fuchsia-300">
              SPD
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
          <span className="text-[10px] uppercase tracking-widest text-zinc-500">Lives</span>
          <LivesDots lives={snapshot.lives} />
        </div>
      </div>
      <ClaimBar pct={snapshot.claimPct} target={target} />
    </div>
  );
}
