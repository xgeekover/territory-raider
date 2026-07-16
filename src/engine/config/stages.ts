import type { ItemCode, StageConfig } from '../core/types';

/**
 * Endless campaign: stages are generated on demand for **any** index, so the
 * run never ends — it only stops when you run out of lives. Difficulty rises
 * monotonically and then plateaus at a hard-but-fair ceiling (speeds are
 * capped, entity counts are capped) so late stages are an endurance test
 * rather than literally impossible.
 *
 * A **boss battle happens every 5th stage** (5, 10, 15, …): the Core fights
 * back with projectile volleys + rage phases. On every other stage it merely
 * wanders (and still contact-kills a drawing player). The boss exists on every
 * stage because the claim flood-fill is anchored to it.
 */

/** A boss battle happens on every Nth stage. */
export const BOSS_STAGE_INTERVAL = 5;

/** True (1-based) when this stage number is a boss battle. */
export function isBossStage(stageNumber: number): boolean {
  return stageNumber % BOSS_STAGE_INTERVAL === 0;
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

// Claimed-area tint cycles for regular stages; boss stages get an ominous red.
const BG_PALETTE = [
  '#14283a',
  '#231b3a',
  '#0f3029',
  '#33192d',
  '#2c3114',
  '#1a2a3f',
  '#34201a',
  '#2a163e',
] as const;
const BOSS_BG = '#3b0d1a';

// Item loadouts. 'L' (laser) is always present so the boss is always killable;
// boss stages add survivability tools (freeze, sweep).
const ITEM_ROTATION: ItemCode[][] = [
  ['L', 'P', 'T'],
  ['L', 'P', 'S'],
  ['L', 'T', 'C', 'P'],
  ['L', 'S', 'P', 'T'],
];
const BOSS_ITEMS: ItemCode[] = ['L', 'C', 'T', 'S', 'P'];

/**
 * Generate the stage config for a 0-based stage index (works for any index, so
 * the campaign is infinite). Every knob is non-decreasing in the index; speeds
 * and counts are capped so difficulty plateaus at a survivable maximum.
 */
export function getStage(i: number): StageConfig {
  const n = i + 1;
  const boss = isBossStage(n);

  const stage: StageConfig = {
    bossSpeed: round1(Math.min(24, 8 + i * 0.55)),
    bossHp: Math.min(12, 3 + Math.floor(i / 2)),
    wandererCount: Math.min(10, 2 + Math.floor(i * 0.45)),
    edgeCrawlerCount: Math.min(6, Math.floor(i * 0.3)),
    sparkSpeed: round1(Math.min(22, 6 + i * 0.5)),
    itemTiles: boss ? BOSS_ITEMS : ITEM_ROTATION[i % ITEM_ROTATION.length]!,
    bgColor: boss ? BOSS_BG : BG_PALETTE[i % BG_PALETTE.length]!,
  };

  if (boss) {
    // The difficulty spike of a boss stage is the fire-fight itself; firepower
    // also scales with depth (faster volleys, faster projectiles) up to a cap.
    stage.bossBattle = true;
    stage.bossFireCooldown = round1(Math.max(1.2, 3.0 - i * 0.09));
    stage.projectileSpeed = round1(Math.min(28, 12 + i * 0.5));
  }

  return stage;
}

/**
 * A finite preview of the first stages — used by tooling and tests. The engine
 * itself calls {@link getStage} directly so the real campaign is unbounded.
 */
export const STAGE_COUNT = 30;
export const STAGES: StageConfig[] = Array.from({ length: STAGE_COUNT }, (_, i) => getStage(i));
