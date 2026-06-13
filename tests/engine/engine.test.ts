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

  it('reaches victory after the final stage is cleared', () => {
    const engine = makeEngine(); // 3 stages
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
  it('ships 8 stages with a monotonic difficulty curve', () => {
    expect(STAGES).toHaveLength(8);
    for (let i = 1; i < STAGES.length; i++) {
      const prev = STAGES[i - 1] as StageConfig;
      const cur = STAGES[i] as StageConfig;
      expect(cur.bossSpeed).toBeGreaterThanOrEqual(prev.bossSpeed);
      expect(cur.bossHp).toBeGreaterThanOrEqual(prev.bossHp);
      expect(cur.wandererCount).toBeGreaterThanOrEqual(prev.wandererCount);
      expect(cur.sparkSpeed).toBeGreaterThanOrEqual(prev.sparkSpeed);
    }
  });

  it('gives every stage a Laser item and a distinct background color', () => {
    const colors = new Set<string>();
    for (const stage of STAGES) {
      expect(stage.itemTiles).toContain('L');
      colors.add(stage.bgColor);
    }
    expect(colors.size).toBe(STAGES.length);
  });
});
