import { describe, expect, it } from 'vitest';
import { CellState } from '../../src/engine/core/types';
import type { EdgeCrawlerState } from '../../src/engine/core/types';
import { setCell, isWalkable } from '../../src/engine/core/grid';
import { updateBoss, updateEnemies } from '../../src/engine/systems/enemies';
import { EDGE_CRAWLER_SPEED } from '../../src/engine/config/constants';
import { makeTestState } from './helpers';

describe('boss movement (spec 2.4)', () => {
  it('reflects off claimed cells and keeps its configured speed', () => {
    const state = makeTestState();
    // wall of claimed cells at x=10
    for (let y = 1; y <= 10; y++) setCell(state.grid, 10, y, CellState.Claimed);
    state.boss.pos = { x: 9.5, y: 5.5 };
    state.boss.vel = { x: state.stage.bossSpeed, y: 0 };

    updateBoss(state, 0.2); // would travel 2 cells right, must bounce

    expect(state.boss.vel.x).toBeLessThan(0);
    expect(Math.hypot(state.boss.vel.x, state.boss.vel.y)).toBeCloseTo(state.stage.bossSpeed);
    expect(state.boss.pos.x).toBeLessThan(10);
  });

  it('never leaves the unclaimed area over many ticks', () => {
    const state = makeTestState();
    state.boss.vel = { x: state.stage.bossSpeed * 0.7, y: state.stage.bossSpeed * 0.7 };
    for (let i = 0; i < 600; i++) {
      updateBoss(state, 1 / 60);
      const cx = Math.floor(state.boss.pos.x);
      const cy = Math.floor(state.boss.pos.y);
      expect(state.grid.cells[cy * state.grid.width + cx]).toBe(CellState.Unclaimed);
    }
  });
});

describe('wanderer movement (spec 2.4)', () => {
  it('moves in a straight line and reflects, staying unclaimed-bound', () => {
    const state = makeTestState();
    state.minions.push({
      kind: 'wanderer',
      id: 99,
      alive: true,
      pos: { x: 8, y: 6 },
      vel: { x: 10, y: 0 },
      sparkCooldown: 0,
    });
    for (let i = 0; i < 600; i++) {
      updateEnemies(state, 1 / 60);
      const m = state.minions[0];
      if (m?.kind !== 'wanderer') throw new Error('expected wanderer');
      const cx = Math.floor(m.pos.x);
      const cy = Math.floor(m.pos.y);
      expect(state.grid.cells[cy * state.grid.width + cx]).toBe(CellState.Unclaimed);
    }
  });
});

describe('edge crawler movement (spec 2.4)', () => {
  function makeCrawler(state: ReturnType<typeof makeTestState>): EdgeCrawlerState {
    const crawler: EdgeCrawlerState = {
      kind: 'edgeCrawler',
      id: 7,
      alive: true,
      cell: { x: 8, y: 11 },
      dir: 'left',
      turn: 1,
      stepCooldown: 0,
    };
    state.minions.push(crawler);
    return crawler;
  }

  it('stays on walkable boundary cells while patrolling', () => {
    const state = makeTestState();
    const crawler = makeCrawler(state);
    for (let i = 0; i < 600; i++) {
      updateEnemies(state, 1 / 60);
      expect(isWalkable(state.grid, crawler.cell.x, crawler.cell.y)).toBe(true);
    }
  });

  it('circumnavigates the border ring back to its start', () => {
    const state = makeTestState();
    const crawler = makeCrawler(state);
    const start = { ...crawler.cell };
    const perimeter = 2 * (state.grid.width + state.grid.height) - 4;
    const visited = new Set<string>();
    // simulate enough steps for a full lap
    const seconds = (perimeter + 4) / EDGE_CRAWLER_SPEED;
    const ticks = Math.ceil(seconds * 60);
    let returned = false;
    for (let i = 0; i < ticks; i++) {
      updateEnemies(state, 1 / 60);
      visited.add(`${crawler.cell.x},${crawler.cell.y}`);
      if (i > 10 && crawler.cell.x === start.x && crawler.cell.y === start.y) returned = true;
    }
    expect(returned).toBe(true);
    expect(visited.size).toBeGreaterThan(perimeter / 2); // actually toured the ring
  });

  it('relocates to the frontier when a claim swallows its cell', () => {
    const state = makeTestState();
    const crawler = makeCrawler(state);
    crawler.cell = { x: 3, y: 0 };
    // claim a block making (3,0)'s whole neighborhood solid
    for (let y = 1; y <= 2; y++) {
      for (let x = 1; x <= 6; x++) setCell(state.grid, x, y, CellState.Claimed);
    }
    expect(isWalkable(state.grid, 3, 0)).toBe(false);
    updateEnemies(state, 1 / 60);
    expect(isWalkable(state.grid, crawler.cell.x, crawler.cell.y)).toBe(true);
  });
});
