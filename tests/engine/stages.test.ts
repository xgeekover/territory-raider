import { describe, it, expect } from 'vitest';
import {
  STAGES,
  STAGE_COUNT,
  BOSS_STAGE_INTERVAL,
  isBossStage,
  getStage,
} from '../../src/engine/config/stages';

describe('campaign stages', () => {
  it('generates the configured number of stages', () => {
    expect(STAGES).toHaveLength(STAGE_COUNT);
    expect(STAGE_COUNT).toBeGreaterThanOrEqual(20);
  });

  it('marks a boss battle on every Nth stage and nowhere else', () => {
    STAGES.forEach((stage, i) => {
      const n = i + 1;
      const boss = n % BOSS_STAGE_INTERVAL === 0;
      expect(isBossStage(n)).toBe(boss);
      expect(!!stage.bossBattle).toBe(boss);
      // Boss stages carry firepower tuning; regular stages do not.
      if (boss) {
        expect(stage.bossFireCooldown).toBeGreaterThan(0);
        expect(stage.projectileSpeed).toBeGreaterThan(0);
      } else {
        expect(stage.bossFireCooldown).toBeUndefined();
        expect(stage.projectileSpeed).toBeUndefined();
      }
    });
  });

  it('always includes a laser tile so the boss is killable', () => {
    for (const stage of STAGES) {
      expect(stage.itemTiles).toContain('L');
    }
  });

  it('escalates difficulty monotonically with stage index', () => {
    for (let i = 1; i < STAGES.length; i++) {
      const prev = STAGES[i - 1]!;
      const cur = STAGES[i]!;
      expect(cur.bossSpeed).toBeGreaterThanOrEqual(prev.bossSpeed);
      expect(cur.bossHp).toBeGreaterThanOrEqual(prev.bossHp);
      expect(cur.wandererCount).toBeGreaterThanOrEqual(prev.wandererCount);
      expect(cur.edgeCrawlerCount).toBeGreaterThanOrEqual(prev.edgeCrawlerCount);
      expect(cur.sparkSpeed).toBeGreaterThanOrEqual(prev.sparkSpeed);
    }
  });

  it('makes deeper boss fights fiercer (shorter cooldown, faster shots)', () => {
    const bossStages = STAGES.filter((s) => s.bossBattle);
    expect(bossStages.length).toBeGreaterThanOrEqual(4);
    for (let i = 1; i < bossStages.length; i++) {
      expect(bossStages[i]!.bossFireCooldown!).toBeLessThanOrEqual(bossStages[i - 1]!.bossFireCooldown!);
      expect(bossStages[i]!.projectileSpeed!).toBeGreaterThanOrEqual(bossStages[i - 1]!.projectileSpeed!);
    }
  });

  it('the preview sample ends on a boss battle', () => {
    expect(STAGES[STAGE_COUNT - 1]!.bossBattle).toBe(true);
  });
});

describe('endless generation (getStage)', () => {
  it('generates a valid stage for any index — boss every 5th, laser always', () => {
    for (const i of [0, 4, 9, 49, 99, 499, 4999]) {
      const n = i + 1;
      const stage = getStage(i);
      expect(!!stage.bossBattle).toBe(isBossStage(n));
      expect(isBossStage(n)).toBe(n % BOSS_STAGE_INTERVAL === 0);
      expect(stage.itemTiles).toContain('L');
      expect(stage.bgColor).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('boss cadence holds far out (every 5th, nowhere else)', () => {
    for (let n = 1; n <= 200; n++) {
      expect(!!getStage(n - 1).bossBattle).toBe(n % 5 === 0);
    }
  });

  it('difficulty plateaus at a survivable ceiling (never grows unbounded)', () => {
    const deep = getStage(100_000);
    expect(deep.bossSpeed).toBeLessThanOrEqual(24);
    expect(deep.bossHp).toBeLessThanOrEqual(12);
    expect(deep.wandererCount).toBeLessThanOrEqual(10);
    expect(deep.edgeCrawlerCount).toBeLessThanOrEqual(6);
    expect(deep.sparkSpeed).toBeLessThanOrEqual(22);
    // Deep stage 100001 is not a boss (100001 % 5 = 1); check a deep boss too.
    const deepBoss = getStage(99_999); // stage 100000 → boss
    expect(deepBoss.bossBattle).toBe(true);
    expect(deepBoss.bossFireCooldown!).toBeGreaterThanOrEqual(1.2);
    expect(deepBoss.projectileSpeed!).toBeLessThanOrEqual(28);
  });

  it('is monotonically non-decreasing up to the plateau', () => {
    for (let i = 1; i < 60; i++) {
      const prev = getStage(i - 1);
      const cur = getStage(i);
      expect(cur.bossSpeed).toBeGreaterThanOrEqual(prev.bossSpeed);
      expect(cur.bossHp).toBeGreaterThanOrEqual(prev.bossHp);
      expect(cur.sparkSpeed).toBeGreaterThanOrEqual(prev.sparkSpeed);
    }
  });
});
