import { createStageState } from './core/gameState';
import type { GameState, StateOptions } from './core/gameState';
import type { HudSnapshot, InputState } from './core/types';
import { STAGES } from './config/stages';
import { updatePlayer } from './systems/movement';
import { updateEnemies } from './systems/enemies';
import { applyDeath, updatePlayerCollisions } from './systems/collision';

export type EngineAction =
  | { type: 'confirm' } // Enter: start / next stage / back to title
  | { type: 'togglePause' }
  | { type: 'fire' };

export interface Engine {
  /** Advance the simulation by one fixed timestep. */
  tick(input: InputState, dt: number): void;
  dispatch(action: EngineAction): void;
  /** useSyncExternalStore contract: notified only when the HUD snapshot changes. */
  subscribe(listener: () => void): () => void;
  getSnapshot(): HudSnapshot;
  /** Live mutable state — for the canvas renderer and tests, never for React state. */
  getState(): GameState;
}

function makeSnapshot(state: GameState): HudSnapshot {
  return {
    status: state.status,
    score: state.score,
    lives: state.lives,
    stage: state.stageIndex + 1,
    claimPct: Math.round(state.claimRatio * 1000) / 10,
    laserAmmo: state.laserAmmo,
    timeStopFor: Math.max(0, Math.ceil(state.timeStopFor * 10) / 10),
    speedBoost: state.player.speedMultiplier > 1,
    lastClearBonus: state.lastClearBonus,
    bossHp: state.boss.hp,
    bossAlive: state.boss.alive,
  };
}

function snapshotsEqual(a: HudSnapshot, b: HudSnapshot): boolean {
  return (
    a.status === b.status &&
    a.score === b.score &&
    a.lives === b.lives &&
    a.stage === b.stage &&
    a.claimPct === b.claimPct &&
    a.laserAmmo === b.laserAmmo &&
    a.timeStopFor === b.timeStopFor &&
    a.speedBoost === b.speedBoost &&
    a.lastClearBonus === b.lastClearBonus &&
    a.bossHp === b.bossHp &&
    a.bossAlive === b.bossAlive
  );
}

export function createEngine(options: StateOptions = {}): Engine {
  let state = createStageState(options);
  state.status = 'title';
  let snapshot = makeSnapshot(state);
  const listeners = new Set<() => void>();

  function publish(): void {
    const next = makeSnapshot(state);
    if (!snapshotsEqual(snapshot, next)) {
      snapshot = next;
      for (const l of listeners) l();
    }
  }

  function newGame(): void {
    state = createStageState({ ...options, stageIndex: 0 });
    publish();
  }

  return {
    tick(input: InputState, dt: number): void {
      if (state.status !== 'playing') return;
      state.player.invincibleFor = Math.max(0, state.player.invincibleFor - dt);
      updatePlayer(state, input, dt); // may commit a trail and clear the stage
      if (state.status === 'playing') {
        if (state.timeStopFor > 0) {
          state.timeStopFor = Math.max(0, state.timeStopFor - dt);
        } else {
          updateEnemies(state, dt);
        }
        updatePlayerCollisions(state);
        if (state.playerHit) applyDeath(state);
      }
      publish();
    },

    dispatch(action: EngineAction): void {
      switch (action.type) {
        case 'confirm':
          if (state.status === 'title') {
            newGame();
          } else if (state.status === 'stageClear') {
            const nextIndex = state.stageIndex + 1;
            const stages = options.stages ?? STAGES;
            if (nextIndex >= stages.length) {
              state.status = 'victory';
            } else {
              state = createStageState(
                { ...options, stageIndex: nextIndex },
                { score: state.score, lives: state.lives },
              );
            }
            publish();
          } else if (state.status === 'gameOver' || state.status === 'victory') {
            state = createStageState(options);
            state.status = 'title';
            publish();
          }
          break;
        case 'togglePause':
          if (state.status === 'playing') state.status = 'paused';
          else if (state.status === 'paused') state.status = 'playing';
          publish();
          break;
        case 'fire':
          // Laser arrives in M4.
          break;
      }
    },

    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    getSnapshot: () => snapshot,
    getState: () => state,
  };
}
