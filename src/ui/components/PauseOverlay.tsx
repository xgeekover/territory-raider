export function PauseOverlay() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-zinc-950/70 font-mono">
      <p className="text-3xl font-bold tracking-[0.4em] text-cyan-300">PAUSED</p>
      <p className="text-xs text-zinc-400">PRESS P TO RESUME</p>
    </div>
  );
}
