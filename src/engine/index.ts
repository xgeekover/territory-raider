import { createStageState } from './core/gameState';
import type { GameState, StateOptions } from './core/gameState';
import type { HudSnapshot, InputState } from './core/types';
import { updatePlayer } from './systems/movement';
import { enemySpeedScale, updateEnemies } from './systems/enemies';
import { applyDeath, updatePlayerCollisions } from './systems/collision';
import { spawnSparksFromContacts, updateSparks } from './systems/spark';
import { fireLaser, updateLasers } from './systems/laser';
import { bossRageLevel, updateBossAttack } from './systems/bossAttack';

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
    // Whole seconds (rounded up) so the HUD re-renders ~1x/sec, not every tick.
    stageTimeLeft: Math.ceil(state.stageTimeLeft),
    laserAmmo: state.laserAmmo,
    timeStopFor: Math.max(0, Math.ceil(state.timeStopFor * 10) / 10),
    slowedFor: Math.max(0, Math.ceil(state.player.slowedFor * 10) / 10),
    stunnedFor: Math.max(0, Math.ceil(state.player.stunnedFor * 10) / 10),
    speedBoost: state.player.speedMultiplier > 1,
    lastClearBonus: state.lastClearBonus,
    bossHp: state.boss.hp,
    bossHpMax: state.stage.bossHp,
    bossAlive: state.boss.alive,
    bossRage: bossRageLevel(state),
  };
}

function snapshotsEqual(a: HudSnapshot, b: HudSnapshot): boolean {
  return (
    a.status === b.status &&
    a.score === b.score &&
    a.lives === b.lives &&
    a.stage === b.stage &&
    a.claimPct === b.claimPct &&
    a.stageTimeLeft === b.stageTimeLeft &&
    a.laserAmmo === b.laserAmmo &&
    a.timeStopFor === b.timeStopFor &&
    a.slowedFor === b.slowedFor &&
    a.stunnedFor === b.stunnedFor &&
    a.speedBoost === b.speedBoost &&
    a.lastClearBonus === b.lastClearBonus &&
    a.bossHp === b.bossHp &&
    a.bossHpMax === b.bossHpMax &&
    a.bossAlive === b.bossAlive &&
    a.bossRage === b.bossRage
  );
}

export function createEngine(options: StateOptions = {}): Engine {
  let state = createStageState(options);
  state.status = options.startPlaying ? 'playing' : 'title';
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
      state.player.slowedFor = Math.max(0, state.player.slowedFor - dt);
      state.player.stunnedFor = Math.max(0, state.player.stunnedFor - dt);
      state.player.hazardGraceFor = Math.max(0, state.player.hazardGraceFor - dt);
      // Chain-lightning bookkeeping runs in real time (not enemy-scaled dt).
      for (const m of state.minions) {
        if (m.frozenFor > 0) m.frozenFor = Math.max(0, m.frozenFor - dt);
      }
      if (state.lightningArcs.length > 0) {
        state.lightningArcs = state.lightningArcs.filter((a) => (a.ttl -= dt) > 0);
      }
      updatePlayer(state, input, dt); // may commit a trail and clear the stage
      if (state.status === 'playing') {
        updateLasers(state, dt); // may kill the boss and clear the stage
      }
      if (state.status === 'playing') {
        if (state.timeStopFor > 0) {
          state.timeStopFor = Math.max(0, state.timeStopFor - dt); // item 'T' freeze
        } else {
          // Enemies cover more ground per tick as the stage clock runs low.
          const edt = dt * enemySpeedScale(state);
          const trailContacts = updateEnemies(state, edt);
          spawnSparksFromContacts(state, trailContacts);
          updateSparks(state, edt);
          updateBossAttack(state, edt); // boss battle: volleys + projectile flight
        }
        updatePlayerCollisions(state);
        if (state.playerHit) applyDeath(state);
      }
      // Stage countdown (real time, keeps ticking through a Time Stop). Running
      // it out costs a life; applyDeath refills the clock for the next life.
      if (state.status === 'playing') {
        state.stageTimeLeft = Math.max(0, state.stageTimeLeft - dt);
        if (state.stageTimeLeft <= 0) applyDeath(state);
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
            // Endless: always advance to the next generated stage. Only a
            // pinned finite stage list (tests) can reach 'victory' by running out.
            if (options.stages && nextIndex >= options.stages.length) {
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
          if (fireLaser(state)) publish();
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
