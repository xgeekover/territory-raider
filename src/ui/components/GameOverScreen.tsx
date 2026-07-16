import type { HudSnapshot } from '../../engine/core/types';
import { Confetti } from './Confetti';

export function GameOverScreen({ snapshot, highScore }: { snapshot: HudSnapshot; highScore: number }) {
  const isRecord = snapshot.score > 0 && snapshot.score >= highScore;
  return (
    <div className="overlay-in absolute inset-0 flex flex-col items-center justify-center gap-4 bg-zinc-950/85 font-mono">
      {isRecord && <Confetti count={50} />}
      <p className="text-4xl font-bold tracking-[0.3em] text-rose-400 drop-shadow-[0_0_18px_rgba(251,113,133,0.7)]">
        GAME OVER
      </p>
      <p className="text-sm text-zinc-300">
        FINAL SCORE{' '}
        <span className="text-lg text-cyan-300 tabular-nums">{snapshot.score.toLocaleString('en-US')}</span>
      </p>
      {isRecord ? (
        <p className="animate-pulse text-base font-bold tracking-widest text-fuchsia-300 drop-shadow-[0_0_12px_rgba(217,70,239,0.8)]">
          ★ NEW HIGH SCORE ★
        </p>
      ) : (
        highScore > 0 && (
          <p className="text-xs text-zinc-500">
            BEST <span className="tabular-nums text-zinc-400">{highScore.toLocaleString('en-US')}</span>
          </p>
        )
      )}
      <p className="mt-2 animate-pulse text-xs text-zinc-400">PRESS ENTER</p>
    </div>
  );
}
