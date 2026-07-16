import { describe, expect, it } from 'vitest';
import { createEngine } from '../../src/engine';
import type { StageConfig } from '../../src/engine/core/types';
import { STAGES } from '../../src/engine/config/stages';

const QUIET: StageConfig = {
  bossSpeed: 8,
  bossHp: 1,
  wandererCount: 0,
  edgeCrawlerCount: 0,
  sparkSpeed: 6,
  itemTiles: [],
  bgColor: '#101010',
};

function makeEngine() {
  return createEngine({ width: 16, height: 12, seed: 1, stages: [QUIET, QUIET, QUIET] });
}

const noInput = { dirs: [] as never[], action: false };

describe('engine lifecycle', () => {
  it('starts on the title screen and only begins on confirm', () => {
    const engine = makeEngine();
    expect(engine.getSnapshot().status).toBe('title');
    engine.tick(noInput, 1 / 60);
    expect(engine.getSnapshot().status).toBe('title'); // ticks ignored until started

    engine.dispatch({ type: 'confirm' });
    expect(engine.getSnapshot().status).toBe('playing');
    expect(engine.getSnapshot().lives).toBe(3);
    expect(engine.getSnapshot().stage).toBe(1);
  });

  it('toggles pause and freezes the simulation', () => {
    const engine = makeEngine();
    engine.dispatch({ type: 'confirm' });
    engine.dispatch({ type: 'togglePause' });
    expect(engine.getSnapshot().status).toBe('paused');
    const bossBefore = { ...engine.getState().boss.pos };
    engine.tick(noInput, 1 / 60);
    expect(engine.getState().boss.pos).toEqual(bossBefore); // nothing moved
    engine.dispatch({ type: 'togglePause' });
    expect(engine.getSnapshot().status).toBe('playing');
  });

  it('advances to the next stage on confirm after a clear, carrying score and lives', () => {
    const engine = makeEngine();
    engine.dispatch({ type: 'confirm' });
    const state = engine.getState();
    state.score = 12345;
    state.lives = 2;
    state.status = 'stageClear';

    engine.dispatch({ type: 'confirm' });
    expect(engine.getSnapshot().status).toBe('playing');
    expect(engine.getSnapshot().stage).toBe(2);
    expect(engine.getSnapshot().score).toBe(12345);
    expect(engine.getSnapshot().lives).toBe(2);
  });

  it('reaches victory after a pinned finite stage list is cleared', () => {
    const engine = makeEngine(); // 3 explicit stages
    engine.dispatch({ type: 'confirm' });
    for (let stage = 1; stage <= 3; stage++) {
      expect(engine.getSnapshot().stage).toBe(stage);
      engine.getState().status = 'stageClear';
      engine.dispatch({ type: 'confirm' });
    }
    expect(engine.getSnapshot().status).toBe('victory');

    engine.dispatch({ type: 'confirm' }); // back to title
    expect(engine.getSnapshot().status).toBe('title');
  });

  it('is endless with the real generator — clearing stages never ends the run', () => {
    const engine = createEngine({ seed: 1 }); // real grid + generator, no pinned stages
    engine.dispatch({ type: 'confirm' }); // title → playing stage 1
    for (let stage = 1; stage <= 23; stage++) {
      expect(engine.getSnapshot().stage).toBe(stage);
      engine.getState().status = 'stageClear';
      engine.dispatch({ type: 'confirm' });
      expect(engine.getSnapshot().status).toBe('playing'); // advanced, never 'victory'
    }
    expect(engine.getSnapshot().stage).toBe(24);
    // Boss battles land on every 5th stage in the endless run.
    expect(engine.getState().stage.bossBattle).toBeUndefined(); // stage 24 is not a boss
  });

  it('only republishes the snapshot when a HUD value actually changes', () => {
    const engine = makeEngine();
    let notifications = 0;
    engine.subscribe(() => notifications++);
    engine.dispatch({ type: 'confirm' });
    const afterStart = notifications;
    engine.tick(noInput, 1 / 60); // boss moves but no HUD field changes
    expect(notifications).toBe(afterStart);
  });
});

describe('stage config (spec 2.8)', () => {
  // Campaign-wide invariants (count, boss cadence, deep-curve) live in
  // stages.test.ts; this keeps a light monotonicity check alongside the engine.
  it('ships a multi-stage, monotonically escalating campaign', () => {
    expect(STAGES.length).toBeGreaterThanOrEqual(8);
    for (let i = 1; i < STAGES.length; i++) {
      const prev = STAGES[i - 1] as StageConfig;
      const cur = STAGES[i] as StageConfig;
      expect(cur.bossSpeed).toBeGreaterThanOrEqual(prev.bossSpeed);
      expect(cur.bossHp).toBeGreaterThanOrEqual(prev.bossHp);
      expect(cur.wandererCount).toBeGreaterThanOrEqual(prev.wandererCount);
      expect(cur.sparkSpeed).toBeGreaterThanOrEqual(prev.sparkSpeed);
    }
  });

  it('gives every stage a Laser item and a background color', () => {
    for (const stage of STAGES) {
      expect(stage.itemTiles).toContain('L');
      expect(stage.bgColor).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});
