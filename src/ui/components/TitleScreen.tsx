export function TitleScreen({ highScore, muted }: { highScore: number; muted: boolean }) {
  return (
    <div className="overlay-in absolute inset-0 flex flex-col items-center justify-center gap-6 bg-zinc-950/85 font-mono">
      <div className="title-grid pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="relative flex flex-col items-center gap-6">
        <div className="title-glow flex flex-col items-center">
          <h1 className="text-5xl font-bold tracking-[0.3em] text-cyan-300 drop-shadow-[0_0_18px_rgba(34,211,238,0.7)]">
            TERRITORY
          </h1>
          <h1 className="text-5xl font-bold tracking-[0.3em] text-fuchsia-400 drop-shadow-[0_0_18px_rgba(217,70,239,0.7)]">
            RAIDER
          </h1>
        </div>
        {highScore > 0 && (
          <p className="text-sm text-zinc-400">
            HIGH SCORE <span className="text-cyan-300 tabular-nums">{highScore.toLocaleString('en-US')}</span>
          </p>
        )}
        <div className="mt-2 grid grid-cols-[auto_auto] gap-x-6 gap-y-1 text-xs text-zinc-400">
          <span className="text-zinc-500">ARROWS</span><span>Move along the frontier</span>
          <span className="text-zinc-500">SPACE (hold)</span><span>Cut into the dark</span>
          <span className="text-zinc-500">X</span><span>Fire laser</span>
          <span className="text-zinc-500">P</span><span>Pause</span>
          <span className="text-zinc-500">M</span><span>Sound {muted ? 'off' : 'on'}</span>
        </div>
        <p className="mt-4 animate-pulse text-lg text-zinc-200">PRESS ENTER TO START</p>
        <p className="text-xs text-zinc-600">Claim 80% of the field. Don't get caught drawing.</p>
      </div>
    </div>
  );
}
