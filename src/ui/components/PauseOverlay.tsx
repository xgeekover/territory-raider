export function PauseOverlay({ muted }: { muted: boolean }) {
  return (
    <div className="overlay-in absolute inset-0 flex flex-col items-center justify-center gap-4 bg-zinc-950/70 font-mono backdrop-blur-[2px]">
      <p className="text-3xl font-bold tracking-[0.4em] text-cyan-300 drop-shadow-[0_0_14px_rgba(34,211,238,0.6)]">
        PAUSED
      </p>
      <div className="grid grid-cols-[auto_auto] gap-x-5 gap-y-1 text-xs text-zinc-400">
        <span className="text-zinc-500">P</span><span>Resume</span>
        <span className="text-zinc-500">M</span><span>Sound {muted ? 'off → on' : 'on → off'}</span>
      </div>
    </div>
  );
}
