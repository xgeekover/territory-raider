import type { ItemCode, StageConfig, ThemeKind } from '../core/types';

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

/** The elemental theme rotates every block of 10 stages. */
export const THEME_BLOCK_SIZE = 10;
const THEME_CYCLE: ThemeKind[] = ['fire', 'ice', 'lightning'];

/**
 * Theme for a 0-based stage index: the first block (stages 1-10) is neutral
 * to teach the base game; from stage 11 on, blocks cycle fire → ice →
 * lightning forever.
 */
export function themeOf(i: number): ThemeKind | undefined {
  const block = Math.floor(i / THEME_BLOCK_SIZE);
  if (block === 0) return undefined;
  return THEME_CYCLE[(block - 1) % THEME_CYCLE.length];
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

// Claimed-area tint cycles for regular stages; boss stages get an ominous red.
// Themed blocks pull from a palette matching their element.
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
const THEME_BG: Record<ThemeKind, readonly string[]> = {
  fire: ['#361410', '#3a1a0c', '#2f100f', '#3d2008'],
  ice: ['#0e2436', '#102e40', '#0c2030', '#143247'],
  lightning: ['#2e2a0c', '#332e10', '#292608', '#3a3312'],
};
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
  const theme = themeOf(i);

  const stage: StageConfig = {
    bossSpeed: round1(Math.min(24, 8 + i * 0.55)),
    bossHp: Math.min(12, 3 + Math.floor(i / 2)),
    wandererCount: Math.min(10, 2 + Math.floor(i * 0.45)),
    edgeCrawlerCount: Math.min(6, Math.floor(i * 0.3)),
    sparkSpeed: round1(Math.min(22, 6 + i * 0.5)),
    itemTiles: boss ? BOSS_ITEMS : ITEM_ROTATION[i % ITEM_ROTATION.length]!,
    bgColor: boss
      ? BOSS_BG
      : theme
        ? THEME_BG[theme][i % THEME_BG[theme].length]!
        : BG_PALETTE[i % BG_PALETTE.length]!,
    // Terrain: stage 1 is an open field; rock clusters grow with depth.
    obstacleClusters: n === 1 ? 0 : Math.min(4, 1 + Math.floor(i / 4)),
  };

  if (theme) {
    stage.theme = theme;
    stage.hazardPatches = Math.min(4, 2 + Math.floor(i / 15));
  }

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
