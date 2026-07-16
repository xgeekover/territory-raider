import type { HudSnapshot } from '../../engine/core/types';
import { Confetti } from './Confetti';

export function VictoryScreen({ snapshot }: { snapshot: HudSnapshot }) {
  return (
    <div className="overlay-in absolute inset-0 flex flex-col items-center justify-center gap-4 bg-zinc-950/85 font-mono">
      <Confetti count={80} />
      <p className="title-glow text-4xl font-bold tracking-[0.3em] text-cyan-300 drop-shadow-[0_0_18px_rgba(34,211,238,0.7)]">
        SECTOR SECURED
      </p>
      <p className="text-sm text-zinc-300">ALL {snapshot.stage} STAGES RECLAIMED</p>
      <p className="text-sm text-zinc-300">
        FINAL SCORE{' '}
        <span className="text-xl text-fuchsia-300 tabular-nums">{snapshot.score.toLocaleString('en-US')}</span>
      </p>
      <p className="mt-2 animate-pulse text-xs text-zinc-400">PRESS ENTER</p>
    </div>
  );
}
