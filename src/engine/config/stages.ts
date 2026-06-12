import type { StageConfig } from '../core/types';

/**
 * 8 stages with a rising difficulty curve: boss speed/HP, minion counts and
 * spark speed all increase; bgColor differentiates the revealed claimed area.
 */
export const STAGES: StageConfig[] = [
  { bossSpeed: 9, bossHp: 3, wandererCount: 2, edgeCrawlerCount: 0, sparkSpeed: 6, itemTiles: ['L', 'P', 'T'], bgColor: '#14283a' },
  { bossSpeed: 10, bossHp: 4, wandererCount: 3, edgeCrawlerCount: 1, sparkSpeed: 7, itemTiles: ['L', 'P', 'S'], bgColor: '#231b3a' },
  { bossSpeed: 11, bossHp: 4, wandererCount: 3, edgeCrawlerCount: 1, sparkSpeed: 8, itemTiles: ['L', 'T', 'C', 'P'], bgColor: '#0f3029' },
  { bossSpeed: 12, bossHp: 5, wandererCount: 4, edgeCrawlerCount: 2, sparkSpeed: 9, itemTiles: ['L', 'S', 'P', 'T'], bgColor: '#33192d' },
  { bossSpeed: 13, bossHp: 5, wandererCount: 5, edgeCrawlerCount: 2, sparkSpeed: 10, itemTiles: ['L', 'C', 'T', 'P'], bgColor: '#2c3114' },
  { bossSpeed: 14, bossHp: 6, wandererCount: 5, edgeCrawlerCount: 3, sparkSpeed: 11, itemTiles: ['L', 'S', 'C', 'P', 'T'], bgColor: '#1a2a3f' },
  { bossSpeed: 15, bossHp: 7, wandererCount: 6, edgeCrawlerCount: 3, sparkSpeed: 12, itemTiles: ['L', 'S', 'T', 'P', 'C'], bgColor: '#34201a' },
  { bossSpeed: 17, bossHp: 8, wandererCount: 7, edgeCrawlerCount: 4, sparkSpeed: 14, itemTiles: ['L', 'S', 'T', 'C', 'P'], bgColor: '#2a163e' },
];
