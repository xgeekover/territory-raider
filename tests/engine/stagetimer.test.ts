import { describe, expect, it } from 'vitest';
import { createEngine } from '../../src/engine';
import type { InputState, StageConfig } from '../../src/engine/core/types';
import { enemySpeedScale } from '../../src/engine/systems/enemies';
import {
  ENEMY_SPEED_SCALE_DANGER,
  ENEMY_SPEED_SCALE_WARN,
  STAGE_TIME_DANGER,
  STAGE_TIME_LIMIT,
  STAGE_TIME_WARN,
} from '../../src/engine/config/constants';
import { makeTestState } from './helpers';

const QUIET: StageConfig = {
  bossSpeed: 8,
  bossHp: 1,
  wandererCount: 0,
  edgeCrawlerCount: 0,
  sparkSpeed: 6,
  itemTiles: [],
  bgColor: '#101010',
};

const noInput: InputState = { dirs: [], action: false };

function startedEngine() {
  const engine = createEngine({ width: 24, height: 18, seed: 7, stages: [QUIET, QUIET] });
  engine.dispatch({ type: 'confirm' }); // title → playing
  return engine;
}

describe('stage countdown', () => {
  it('starts each stage with a full clock', () => {
    const engine = startedEngine();
    expect(engine.getState().stageTimeLeft).toBe(STAGE_TIME_LIMIT);
    expect(engine.getSnapshot().stageTimeLeft).toBe(STAGE_TIME_LIMIT);
  });

  it('drains in real time while playing', () => {
    const engine = startedEngine();
    for (let i = 0; i < 60; i++) engine.tick(noInput, 1 / 60); // ~1s
    expect(engine.getState().stageTimeLeft).toBeCloseTo(STAGE_TIME_LIMIT - 1, 1);
  });

  it('does not drain while paused', () => {
    const engine = startedEngine();
    engine.dispatch({ type: 'togglePause' });
    engine.tick(noInput, 1 / 60);
    expect(engine.getState().stageTimeLeft).toBe(STAGE_TIME_LIMIT);
  });

  it('costs a life and refills the clock when it runs out', () => {
    const engine = startedEngine();
    const state = engine.getState();
    state.stageTimeLeft = 0.005; // about to expire
    engine.tick(noInput, 1 / 60);

    expect(engine.getSnapshot().lives).toBe(2); // one life lost
    expect(engine.getState().status).toBe('playing');
    expect(engine.getState().stageTimeLeft).toBeCloseTo(STAGE_TIME_LIMIT, 5);
  });

  it('ends the game if the clock runs out with the last life', () => {
    const engine = startedEngine();
    const state = engine.getState();
    state.lives = 1;
    state.stageTimeLeft = 0.005;
    engine.tick(noInput, 1 / 60);

    expect(engine.getState().status).toBe('gameOver');
    expect(engine.getSnapshot().lives).toBe(0);
  });
});

describe('enemySpeedScale (time-pressure ramp)', () => {
  it('is 1x above the warn window', () => {
    const state = makeTestState();
    state.stageTimeLeft = STAGE_TIME_WARN + 0.1;
    expect(enemySpeedScale(state)).toBe(1);
  });

  it('speeds up at/below the warn window', () => {
    const state = makeTestState();
    state.stageTimeLeft = STAGE_TIME_WARN;
    expect(enemySpeedScale(state)).toBe(ENEMY_SPEED_SCALE_WARN);
  });

  it('speeds up more at/below the danger window', () => {
    const state = makeTestState();
    state.stageTimeLeft = STAGE_TIME_DANGER;
    expect(enemySpeedScale(state)).toBe(ENEMY_SPEED_SCALE_DANGER);
    expect(ENEMY_SPEED_SCALE_DANGER).toBeGreaterThan(ENEMY_SPEED_SCALE_WARN);
  });

  it('actually moves the boss farther per tick when time is low', () => {
    const calm = createEngine({ width: 40, height: 30, seed: 3, stages: [QUIET] });
    const rushed = createEngine({ width: 40, height: 30, seed: 3, stages: [QUIET] });
    calm.dispatch({ type: 'confirm' });
    rushed.dispatch({ type: 'confirm' });
    rushed.getState().stageTimeLeft = STAGE_TIME_DANGER; // danger scale

    const before = { ...calm.getState().boss.pos };
    calm.tick(noInput, 1 / 60);
    rushed.tick(noInput, 1 / 60);

    const dCalm = Math.hypot(
      calm.getState().boss.pos.x - before.x,
      calm.getState().boss.pos.y - before.y,
    );
    const dRush = Math.hypot(
      rushed.getState().boss.pos.x - before.x,
      rushed.getState().boss.pos.y - before.y,
    );
    expect(dRush).toBeCloseTo(dCalm * ENEMY_SPEED_SCALE_DANGER, 4);
  });
});
