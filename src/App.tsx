import { useEffect, useState } from 'react';
import { useGameEngine } from './ui/hooks/useGameEngine';
import { GameCanvas } from './ui/components/GameCanvas';
import { Hud } from './ui/components/Hud';
import { TitleScreen } from './ui/components/TitleScreen';
import { PauseOverlay } from './ui/components/PauseOverlay';
import { loadHighScore, saveHighScore } from './ui/highscore';

export default function App() {
  const { engine, snapshot } = useGameEngine();
  const [highScore, setHighScore] = useState(loadHighScore);

  useEffect(() => {
    if (snapshot.score > highScore) {
      setHighScore(snapshot.score);
      saveHighScore(snapshot.score);
    }
  }, [snapshot.score, highScore]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-zinc-950 py-6 font-mono text-zinc-100">
      <div className="w-[768px] max-w-full">
        <Hud snapshot={snapshot} highScore={highScore} />
      </div>
      <div className="relative rounded border border-zinc-800 p-1">
        <GameCanvas engine={engine} />
        {snapshot.status === 'title' && <TitleScreen highScore={highScore} />}
        {snapshot.status === 'paused' && <PauseOverlay />}
      </div>
      <p className="text-xs text-zinc-600">
        ARROWS move · SPACE hold to draw · X laser · P pause · ENTER start
      </p>
    </div>
  );
}
