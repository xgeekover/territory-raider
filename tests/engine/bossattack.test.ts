import { describe, it, expect } from 'vitest';
import { makeTestState, placeBoss, layTrail, TEST_BOSS_STAGE } from './helpers';
import { bossRageLevel, updateBossAttack } from '../../src/engine/systems/bossAttack';
import { applyDeath } from '../../src/engine/systems/collision';
import { createEngine } from '../../src/engine';
import {
  BOSS_RAGE1_RATIO,
  BOSS_RAGE2_RATIO,
  FIXED_DT,
} from '../../src/engine/config/constants';

/** Every boss-battle test runs on a stage where the boss actually fights. */
const bossState = () => makeTestState({ stages: [TEST_BOSS_STAGE] });

/** Step the attack system by whole seconds' worth of fixed ticks. */
function step(state: ReturnType<typeof makeTestState>, seconds: number): void {
  const ticks = Math.round(seconds / FIXED_DT);
  for (let i = 0; i < ticks; i++) updateBossAttack(state, FIXED_DT);
}

describe('boss rage', () => {
  it('escalates with claimed ratio', () => {
    const state = bossState();
    state.claimRatio = 0;
    expect(bossRageLevel(state)).toBe(0);
    state.claimRatio = BOSS_RAGE1_RATIO;
    expect(bossRageLevel(state)).toBe(1);
    state.claimRatio = BOSS_RAGE2_RATIO;
    expect(bossRageLevel(state)).toBe(2);
  });
});

describe('boss firing', () => {
  it('fires an aimed projectile once the cooldown elapses', () => {
    const state = bossState();
    placeBoss(state, { x: 8, y: 6 });
    state.player.pos = { x: 8, y: 9 }; // directly below the boss
    expect(state.projectiles).toHaveLength(0);

    step(state, (TEST_BOSS_STAGE.bossFireCooldown ?? 2.8) + 0.1);
    expect(state.projectiles.length).toBeGreaterThanOrEqual(1);
    const shot = state.projectiles[0]!;
    // Aimed at the player: dominant velocity component is +y, negligible x.
    expect(shot.vel.y).toBeGreaterThan(0);
    expect(Math.abs(shot.vel.x)).toBeLessThan(Math.abs(shot.vel.y) * 0.2);
  });

  it('does not fire while the boss is dead', () => {
    const state = bossState();
    state.boss.alive = false;
    step(state, 10);
    expect(state.projectiles).toHaveLength(0);
  });

  it('fires a 3-shot fan at rage 2', () => {
    const state = bossState();
    placeBoss(state, { x: 8, y: 6 });
    state.claimRatio = BOSS_RAGE2_RATIO;
    state.boss.fireCooldown = FIXED_DT; // fire on the next tick
    updateBossAttack(state, FIXED_DT);
    expect(state.projectiles).toHaveLength(3);
  });

  it('rage shortens the effective cooldown', () => {
    const calm = bossState();
    const furious = bossState();
    for (const s of [calm, furious]) {
      placeBoss(s, { x: 8, y: 6 });
      s.boss.fireCooldown = FIXED_DT;
    }
    furious.claimRatio = BOSS_RAGE2_RATIO;
    updateBossAttack(calm, FIXED_DT); // both fire now and reset their cooldowns
    updateBossAttack(furious, FIXED_DT);
    expect(furious.boss.fireCooldown).toBeLessThan(calm.boss.fireCooldown);
  });
});

describe('projectile flight', () => {
  it('advances by velocity each tick', () => {
    const state = bossState();
    state.boss.alive = false; // isolate flight from firing
    state.projectiles.push({ id: 1, pos: { x: 8, y: 6 }, vel: { x: 10, y: 0 } });
    updateBossAttack(state, 0.1);
    expect(state.projectiles[0]!.pos.x).toBeCloseTo(9, 5);
  });

  it('splashes on the border wall', () => {
    const state = bossState();
    state.boss.alive = false;
    // Fly straight at the left border (x=0 is Border on the test grid).
    state.projectiles.push({ id: 1, pos: { x: 2.5, y: 6 }, vel: { x: -20, y: 0 } });
    step(state, 1);
    expect(state.projectiles).toHaveLength(0);
  });

  it('kills a drawing player on contact', () => {
    const state = bossState();
    state.boss.alive = false;
    layTrail(state, [{ x: 8, y: 6 }], { x: 8, y: 1 }); // drawing at (8,6)
    state.projectiles.push({ id: 1, pos: { x: 8.5, y: 6.4 }, vel: { x: 0, y: 0.01 } });
    updateBossAttack(state, FIXED_DT);
    expect(state.playerHit).toBe(true);
    expect(state.projectiles).toHaveLength(0); // consumed by the hit
  });

  it('cannot hurt a shielded player', () => {
    const state = bossState();
    state.boss.alive = false;
    state.player.pos = { x: 8, y: 6 };
    state.player.mode = 'shield';
    state.projectiles.push({ id: 1, pos: { x: 8.5, y: 6.5 }, vel: { x: 0.01, y: 0 } });
    updateBossAttack(state, FIXED_DT);
    expect(state.playerHit).toBe(false);
    expect(state.projectiles).toHaveLength(1); // flies on
  });

  it('cannot hurt a respawn-invincible player', () => {
    const state = bossState();
    state.boss.alive = false;
    layTrail(state, [{ x: 8, y: 6 }], { x: 8, y: 1 });
    state.player.invincibleFor = 1;
    state.projectiles.push({ id: 1, pos: { x: 8.5, y: 6.5 }, vel: { x: 0.01, y: 0 } });
    updateBossAttack(state, FIXED_DT);
    expect(state.playerHit).toBe(false);
  });
});

describe('boss battle integration', () => {
  it('death clears projectiles and grants a firing grace', () => {
    const state = bossState();
    layTrail(state, [{ x: 8, y: 6 }], { x: 8, y: 1 });
    state.projectiles.push({ id: 1, pos: { x: 3, y: 3 }, vel: { x: 5, y: 0 } });
    state.boss.fireCooldown = 0.2;
    state.playerHit = true;
    applyDeath(state);
    expect(state.projectiles).toHaveLength(0);
    expect(state.boss.fireCooldown).toBeGreaterThanOrEqual(1);
  });

  it('Time Stop freezes firing (engine tick gate)', () => {
    const engine = createEngine({ width: 16, height: 12, seed: 42, stages: [TEST_BOSS_STAGE] });
    engine.dispatch({ type: 'confirm' }); // title → playing
    const state = engine.getState();
    state.boss.fireCooldown = FIXED_DT;
    state.timeStopFor = 5;
    for (let i = 0; i < 30; i++) engine.tick({ dirs: [], action: false }, FIXED_DT);
    expect(state.projectiles).toHaveLength(0); // frozen — never fired

    state.timeStopFor = 0;
    // Check right after the first thawed ticks — a 0.5s window would let the
    // shot reach the border and splash before the assertion.
    for (let i = 0; i < 3; i++) engine.tick({ dirs: [], action: false }, FIXED_DT);
    expect(state.projectiles.length).toBeGreaterThan(0); // thawed — fires
  });
});
