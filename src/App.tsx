import { useEffect, useRef, useState } from 'react';
import { useGameEngine } from './ui/hooks/useGameEngine';
import { useFitScale } from './ui/hooks/useFitScale';
import { GameCanvas } from './ui/components/GameCanvas';
import { Hud } from './ui/components/Hud';
import { TitleScreen } from './ui/components/TitleScreen';
import { PauseOverlay } from './ui/components/PauseOverlay';
import { GameOverScreen } from './ui/components/GameOverScreen';
import { StageClearScreen } from './ui/components/StageClearScreen';
import { VictoryScreen } from './ui/components/VictoryScreen';
import { StageBanner } from './ui/components/StageBanner';
import { initHighScore, loadHighScore, saveHighScore } from './ui/highscore';
import { audioSystem } from './ui/fx/audio';

export default function App() {
  const { engine, snapshot } = useGameEngine();
  const [highScore, setHighScore] = useState(loadHighScore);
  const [muted, setMuted] = useState(audioSystem.isMuted);
  const [bannerStage, setBannerStage] = useState<number | null>(null);
  const [lastSeenStage, setLastSeenStage] = useState(0);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const scale = useFitScale(contentRef);

  // Desktop build: pull the persisted score from the userData file after mount.
  // Web build: resolves to the localStorage value already shown.
  useEffect(() => {
    let cancelled = false;
    initHighScore().then((persisted) => {
      if (!cancelled) setHighScore((cur) => Math.max(cur, persisted));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (snapshot.score > highScore) {
      setHighScore(snapshot.score);
      saveHighScore(snapshot.score);
    }
  }, [snapshot.score, highScore]);

  // Audio unlock (first user gesture) + M mute toggle, app-wide.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      audioSystem.unlock();
      if (e.key === 'm' || e.key === 'M') setMuted(audioSystem.toggleMuted());
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Losing window focus mid-run pauses instead of dying blind.
  useEffect(() => {
    const onBlur = (): void => {
      if (engine.getSnapshot().status === 'playing') {
        engine.dispatch({ type: 'togglePause' });
      }
    };
    window.addEventListener('blur', onBlur);
    return () => window.removeEventListener('blur', onBlur);
  }, [engine]);

  // Show the stage banner whenever a new stage starts playing.
  useEffect(() => {
    if (snapshot.status === 'playing' && snapshot.stage !== lastSeenStage) {
      setLastSeenStage(snapshot.stage);
      setBannerStage(snapshot.stage);
    } else if (snapshot.status === 'title') {
      setLastSeenStage(0); // a fresh run re-announces stage 1
    }
  }, [snapshot.status, snapshot.stage, lastSeenStage]);

  return (
    // Fixed-design layout scaled to fit the (freely resizable) window. The
    // canvas keeps its 768×576 internal resolution; only presentation scales.
    <div className="flex h-screen items-center justify-center overflow-hidden bg-zinc-950">
      <div
        ref={contentRef}
        style={{ transform: `scale(${scale})` }}
        className="flex flex-col items-center gap-3 font-mono text-zinc-100"
      >
        <div className="w-[768px]">
          <Hud snapshot={snapshot} highScore={highScore} />
        </div>
        <div className="relative rounded border border-zinc-800 p-1">
          <GameCanvas engine={engine} />
          {snapshot.status === 'title' && <TitleScreen highScore={highScore} muted={muted} />}
          {snapshot.status === 'paused' && <PauseOverlay muted={muted} />}
          {snapshot.status === 'gameOver' && <GameOverScreen snapshot={snapshot} highScore={highScore} />}
          {snapshot.status === 'stageClear' && <StageClearScreen snapshot={snapshot} />}
          {snapshot.status === 'victory' && <VictoryScreen snapshot={snapshot} />}
          {bannerStage !== null && snapshot.status === 'playing' && (
            <StageBanner stage={bannerStage} onDone={() => setBannerStage(null)} />
          )}
        </div>
        <p className="text-xs text-zinc-600">
          ARROWS move · SPACE hold to draw · X laser · P pause · M sound{' '}
          <span className={muted ? 'text-zinc-700' : 'text-cyan-700'}>{muted ? 'off' : 'on'}</span> ·
          ENTER start
        </p>
      </div>
    </div>
  );
}
