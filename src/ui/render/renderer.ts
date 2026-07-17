import { CellState } from '../../engine/core/types';
import type { ItemCode } from '../../engine/core/types';
import type { GameState } from '../../engine/core/gameState';
import { bossRageLevel } from '../../engine/systems/bossAttack';
import { enemySpeedScale } from '../../engine/systems/enemies';
import {
  BOSS_RADIUS,
  CELL_PX,
  EDGE_CRAWLER_SPEED,
  FIXED_DT,
  PLAYER_SPEED,
  WANDERER_RADIUS,
} from '../../engine/config/constants';

/**
 * Render interpolation ("fix your timestep"): the simulation advances in
 * fixed 60Hz ticks, so drawing raw state pins every entity to tick boundaries
 * — visibly steppy for the cell-quantized player (28 steps/s) and crawlers
 * (14/s), and juddery on >60Hz displays where frames outnumber ticks.
 *
 * Two complementary techniques, both render-only:
 * - Float entities (boss, wanderers, projectiles, lasers, sparks) lerp
 *   between a snapshot taken just before the most recent tick (beforeTick)
 *   and current state, by `alpha` = the accumulator's fraction of the next
 *   tick. Every frame moves, even when no tick ran.
 * - Cell-stepped entities (player, crawlers) glide from their previous cell
 *   to the current one at constant velocity, driven by the engine's own step
 *   cooldown (refined by alpha), so the motion is perfectly even.
 *
 * A jump past SNAP_DIST is a teleport (respawn, new stage) and snaps.
 */
const SNAP_DIST = 2.5; // cells

interface VisualPos {
  x: number;
  y: number;
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Constant-velocity progress prev→cur from a step cooldown: 0 right after a
 *  step (still at prev), 1 when the next step is due (arrived at cur). */
function stepProgress(remaining: number, period: number): number {
  if (period <= 0) return 1;
  return 1 - Math.min(1, Math.max(0, remaining) / period);
}

/** Dark-theme palette (zinc/slate base + neon accents). All shapes original. */
const COLORS = {
  unclaimed: '#09090b', // zinc-950 — the fog the boss lives in
  border: '#3f3f46', // zinc-700 ring
  player: '#22d3ee', // cyan-400
  playerDrawing: '#f0abfc', // fuchsia-300
  trail: '#d946ef', // fuchsia-500
  boss: '#e879f9',
  bossCore: '#701a75',
  wanderer: '#fb7185', // rose-400
  crawler: '#fb923c', // orange-400
  spark: '#fde047', // yellow-300
  laser: '#67e8f9',
  itemBox: '#18181b',
} as const;

export interface Renderer {
  /**
   * Draw one frame. `alpha` is the fixed-timestep accumulator's fraction of
   * the next tick (0..1) used for render interpolation; omitting it draws raw
   * current state.
   */
  drawFrame(timeMs: number, alpha?: number): void;
  /** Snapshot moving-entity positions; call right before every engine tick. */
  beforeTick(): void;
  /** Number of static-layer redraws so far (perf instrumentation, spec M6). */
  getStaticRedrawCount(): number;
}

/**
 * Two-layer rendering (spec 3): the grid is rasterized into an offscreen
 * canvas only when gridVersion changes (i.e. on commits); every frame blits
 * it once and draws dynamic entities on top.
 */
export function createRenderer(canvas: HTMLCanvasElement, getState: () => GameState): Renderer {
  const mainCtx = canvas.getContext('2d');
  if (!mainCtx) throw new Error('2D canvas context unavailable');
  const ctx: CanvasRenderingContext2D = mainCtx;

  const staticLayer = document.createElement('canvas');
  staticLayer.width = canvas.width;
  staticLayer.height = canvas.height;
  const offscreenCtx = staticLayer.getContext('2d');
  if (!offscreenCtx) throw new Error('2D canvas context unavailable');
  const staticCtx: CanvasRenderingContext2D = offscreenCtx;

  let staticVersion = -1;
  /** New stage = new grid object with gridVersion reset, so track identity too. */
  let staticGrid: GameState['grid'] | null = null;
  let staticRedraws = 0;

  // ---- Render-interpolation state (see header comment) ----
  // Previous-tick snapshot of float entities.
  let prevBoss: VisualPos | null = null;
  const prevWanderers = new Map<number, VisualPos>();
  const prevProjectiles = new Map<number, VisualPos>();
  let prevSparks: number[] = [];
  let prevLasers: VisualPos[] = [];
  // Cell-stepped entities: last distinct cell, glided out of at constant speed.
  let playerPrev: VisualPos | null = null;
  let playerCur: VisualPos | null = null;
  let playerLastInvincible = 0;
  const crawlerTrack = new Map<number, { prev: VisualPos; cur: VisualPos }>();

  function resetInterpolation(): void {
    prevBoss = null;
    prevWanderers.clear();
    prevProjectiles.clear();
    prevSparks = [];
    prevLasers = [];
    playerPrev = null;
    playerCur = null;
    crawlerTrack.clear();
  }

  function redrawStatic(state: GameState): void {
    const { grid } = state;
    staticCtx.fillStyle = COLORS.unclaimed;
    staticCtx.fillRect(0, 0, staticLayer.width, staticLayer.height);
    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        const cell = grid.cells[y * grid.width + x];
        if (cell === CellState.Border) {
          staticCtx.fillStyle = COLORS.border;
        } else if (cell === CellState.Claimed) {
          staticCtx.fillStyle = state.stage.bgColor;
        } else {
          continue; // unclaimed/trail keep the dark base; trail is dynamic
        }
        staticCtx.fillRect(x * CELL_PX, y * CELL_PX, CELL_PX, CELL_PX);
      }
    }
    staticRedraws++;
    if (import.meta.env.DEV) {
      console.debug(`[render] static layer redraw #${staticRedraws}`);
    }
  }

  function cellRect(x: number, y: number): [number, number, number, number] {
    return [x * CELL_PX, y * CELL_PX, CELL_PX, CELL_PX];
  }

  function drawTrail(state: GameState): void {
    ctx.fillStyle = COLORS.trail;
    ctx.shadowColor = COLORS.trail;
    ctx.shadowBlur = 6;
    for (const c of state.trail.cells) {
      ctx.fillRect(...cellRect(c.x, c.y));
    }
    ctx.shadowBlur = 0;
  }

  function drawPlayer(state: GameState, timeMs: number, alpha: number): void {
    const p = state.player;
    if (!playerCur || p.pos.x !== playerCur.x || p.pos.y !== playerCur.y) {
      playerPrev = playerCur ?? { x: p.pos.x, y: p.pos.y };
      playerCur = { x: p.pos.x, y: p.pos.y };
    }
    // Teleports (respawn refills invincibility; long jumps) snap, never glide.
    if (
      playerPrev &&
      (p.invincibleFor > playerLastInvincible ||
        Math.abs(playerCur.x - playerPrev.x) + Math.abs(playerCur.y - playerPrev.y) > SNAP_DIST)
    ) {
      playerPrev = { ...playerCur };
    }
    playerLastInvincible = p.invincibleFor;
    const period = 1 / (PLAYER_SPEED * p.speedMultiplier);
    const t = stepProgress(p.moveCooldown - alpha * FIXED_DT, period);
    const rx = playerPrev ? lerp(playerPrev.x, playerCur.x, t) : playerCur.x;
    const ry = playerPrev ? lerp(playerPrev.y, playerCur.y, t) : playerCur.y;
    if (p.invincibleFor > 0 && Math.floor(timeMs / 100) % 2 === 0) return; // blink
    const color = p.mode === 'drawing' ? COLORS.playerDrawing : COLORS.player;
    const cx = (rx + 0.5) * CELL_PX;
    const cy = (ry + 0.5) * CELL_PX;
    const r = CELL_PX * 1.1;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r, cy);
    ctx.lineTo(cx, cy + r);
    ctx.lineTo(cx - r, cy);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  /** Rage escalation: hotter ring color, faster spin, fury adds an outer ring. */
  const RAGE_RING = ['#e879f9', '#fb923c', '#fb7185'] as const;
  const RAGE_SPIN = [400, 240, 150] as const;

  function drawBoss(state: GameState, timeMs: number, alpha: number): void {
    const b = state.boss;
    if (!b.alive) return;
    const rage = bossRageLevel(state);
    const px = prevBoss ?? b.pos;
    const cx = lerp(px.x, b.pos.x, alpha) * CELL_PX;
    const cy = lerp(px.y, b.pos.y, alpha) * CELL_PX;
    const r = BOSS_RADIUS * CELL_PX;
    const spin = timeMs / RAGE_SPIN[rage]!;
    const ring = RAGE_RING[rage]!;

    const hex = (radius: number, phase: number): void => {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = phase + (i * Math.PI) / 3;
        const px = cx + Math.cos(a) * radius;
        const py = cy + Math.sin(a) * radius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    };

    ctx.shadowColor = ring;
    ctx.shadowBlur = 14 + rage * 4;
    ctx.strokeStyle = ring;
    ctx.fillStyle = COLORS.bossCore;
    ctx.lineWidth = 2;
    hex(r, spin);
    ctx.fill();
    ctx.stroke();
    if (rage === 2) {
      // Fury: counter-rotating outer ring.
      ctx.lineWidth = 1.2;
      hex(r * 1.45, -spin * 0.7);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
  }

  function drawProjectiles(state: GameState, alpha: number): void {
    for (const shot of state.projectiles) {
      const px = prevProjectiles.get(shot.id) ?? shot.pos;
      const cx = lerp(px.x, shot.pos.x, alpha) * CELL_PX;
      const cy = lerp(px.y, shot.pos.y, alpha) * CELL_PX;
      // Short motion tail opposite the velocity.
      const speed = Math.hypot(shot.vel.x, shot.vel.y) || 1;
      const tx = cx - (shot.vel.x / speed) * CELL_PX * 1.6;
      const ty = cy - (shot.vel.y / speed) * CELL_PX * 1.6;
      ctx.strokeStyle = 'rgba(251,113,133,0.45)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(cx, cy);
      ctx.stroke();

      ctx.shadowColor = COLORS.wanderer;
      ctx.shadowBlur = 10;
      ctx.fillStyle = COLORS.wanderer;
      ctx.beginPath();
      ctx.arc(cx, cy, CELL_PX * 0.65, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff1f2';
      ctx.beginPath();
      ctx.arc(cx, cy, CELL_PX * 0.25, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawMinions(state: GameState, timeMs: number, alpha: number): void {
    // While Time Stop holds, enemy cooldowns are not draining — don't let the
    // alpha refinement fake motion.
    const frozen = state.timeStopFor > 0;
    const crawlerElapsed = frozen ? 0 : alpha * FIXED_DT * enemySpeedScale(state);
    for (const m of state.minions) {
      if (!m.alive) continue;
      if (m.kind === 'wanderer') {
        const pv = prevWanderers.get(m.id) ?? m.pos;
        const cx = lerp(pv.x, m.pos.x, alpha) * CELL_PX;
        const cy = lerp(pv.y, m.pos.y, alpha) * CELL_PX;
        const r = WANDERER_RADIUS * CELL_PX;
        ctx.shadowColor = COLORS.wanderer;
        ctx.shadowBlur = 8;
        ctx.fillStyle = COLORS.wanderer;
        ctx.beginPath();
        ctx.moveTo(cx, cy - r);
        ctx.lineTo(cx + r, cy);
        ctx.lineTo(cx, cy + r);
        ctx.lineTo(cx - r, cy);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
      } else {
        let track = crawlerTrack.get(m.id);
        if (!track) {
          track = { prev: { x: m.cell.x, y: m.cell.y }, cur: { x: m.cell.x, y: m.cell.y } };
          crawlerTrack.set(m.id, track);
        }
        if (m.cell.x !== track.cur.x || m.cell.y !== track.cur.y) {
          track.prev = track.cur;
          track.cur = { x: m.cell.x, y: m.cell.y };
        }
        if (Math.abs(track.cur.x - track.prev.x) + Math.abs(track.cur.y - track.prev.y) > SNAP_DIST) {
          track.prev = { ...track.cur }; // rejoined the frontier after a claim
        }
        // frozen -> crawlerElapsed is 0, so t holds still mid-glide.
        const t = stepProgress(m.stepCooldown - crawlerElapsed, 1 / EDGE_CRAWLER_SPEED);
        const rx = lerp(track.prev.x, track.cur.x, t);
        const ry = lerp(track.prev.y, track.cur.y, t);
        const pulse = 1 + 0.15 * Math.sin(timeMs / 120);
        const s = CELL_PX * 1.4 * pulse;
        const cx = (rx + 0.5) * CELL_PX;
        const cy = (ry + 0.5) * CELL_PX;
        ctx.shadowColor = COLORS.crawler;
        ctx.shadowBlur = 8;
        ctx.fillStyle = COLORS.crawler;
        ctx.fillRect(cx - s / 2, cy - s / 2, s, s);
        ctx.shadowBlur = 0;
      }
    }
  }

  function drawSparks(state: GameState, alpha: number): void {
    state.sparks.forEach((s, si) => {
      // trailIndex is fractional; alpha-lerp the index across the last tick,
      // then lerp between the two neighboring trail cells (always adjacent)
      // so sparks slide instead of hopping cell to cell.
      const cells = state.trail.cells;
      const pi = prevSparks[si];
      const base =
        pi !== undefined && Math.abs(s.trailIndex - pi) < 2
          ? lerp(pi, s.trailIndex, alpha)
          : s.trailIndex;
      const idx = Math.min(Math.max(0, base), cells.length - 1);
      const i0 = Math.floor(idx);
      const c0 = cells[i0];
      const c1 = cells[Math.min(i0 + 1, cells.length - 1)] ?? c0;
      if (!c0 || !c1) return;
      const f = idx - i0;
      const cx = (c0.x + (c1.x - c0.x) * f + 0.5) * CELL_PX;
      const cy = (c0.y + (c1.y - c0.y) * f + 0.5) * CELL_PX;
      ctx.shadowColor = COLORS.spark;
      ctx.shadowBlur = 12;
      ctx.fillStyle = COLORS.spark;
      ctx.beginPath();
      ctx.arc(cx, cy, CELL_PX * 0.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });
  }

  function drawLasers(state: GameState, alpha: number): void {
    ctx.strokeStyle = COLORS.laser;
    ctx.shadowColor = COLORS.laser;
    ctx.shadowBlur = 10;
    ctx.lineWidth = 2;
    state.lasers.forEach((l, li) => {
      // Index-matched prev; a mismatch after array churn just draws raw.
      const pv = prevLasers[li];
      const near = pv && Math.abs(pv.x - l.pos.x) + Math.abs(pv.y - l.pos.y) < 4;
      const cx = (near ? lerp(pv.x, l.pos.x, alpha) : l.pos.x) * CELL_PX;
      const cy = (near ? lerp(pv.y, l.pos.y, alpha) : l.pos.y) * CELL_PX;
      const dx = l.dir === 'left' ? -1 : l.dir === 'right' ? 1 : 0;
      const dy = l.dir === 'up' ? -1 : l.dir === 'down' ? 1 : 0;
      const len = CELL_PX * 3;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx - dx * len, cy - dy * len);
      ctx.stroke();
    });
    ctx.shadowBlur = 0;
  }

  /** Per-item accent color + vector glyph (icons, not letters — readable at 24px). */
  const ITEM_COLOR: Record<ItemCode, string> = {
    T: '#7dd3fc', // freeze — ice blue snowflake
    S: '#f0abfc', // speed — fuchsia lightning bolt
    L: '#67e8f9', // laser — cyan crosshair
    P: '#fde047', // points — gold star
    C: '#6ee7b7', // sweep — emerald burst
  };

  function drawItemGlyph(code: ItemCode, cx: number, cy: number, r: number): void {
    ctx.lineWidth = Math.max(1.2, r * 0.18);
    ctx.lineCap = 'round';
    switch (code) {
      case 'T': {
        // Snowflake: 6 spokes with V-ticks near the tips.
        for (let i = 0; i < 6; i++) {
          const a = (i * Math.PI) / 3;
          const dx = Math.cos(a);
          const dy = Math.sin(a);
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + dx * r, cy + dy * r);
          ctx.stroke();
          const tx = cx + dx * r * 0.62;
          const ty = cy + dy * r * 0.62;
          const px = -dy;
          const py = dx;
          ctx.beginPath();
          ctx.moveTo(tx + (px - dx) * r * 0.22, ty + (py - dy) * r * 0.22);
          ctx.lineTo(tx, ty);
          ctx.lineTo(tx + (-px - dx) * r * 0.22, ty + (-py - dy) * r * 0.22);
          ctx.stroke();
        }
        break;
      }
      case 'S': {
        // Lightning bolt.
        ctx.beginPath();
        ctx.moveTo(cx + r * 0.3, cy - r);
        ctx.lineTo(cx - r * 0.45, cy + r * 0.18);
        ctx.lineTo(cx - r * 0.05, cy + r * 0.18);
        ctx.lineTo(cx - r * 0.3, cy + r);
        ctx.lineTo(cx + r * 0.45, cy - r * 0.18);
        ctx.lineTo(cx + r * 0.05, cy - r * 0.18);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'L': {
        // Crosshair: ring + 4 ticks + core dot.
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
        ctx.stroke();
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          ctx.beginPath();
          ctx.moveTo(cx + dx * r * 0.7, cy + dy * r * 0.7);
          ctx.lineTo(cx + dx * r, cy + dy * r);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.14, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'P': {
        // 5-point star.
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + (i * Math.PI) / 5;
          const rad = i % 2 === 0 ? r : r * 0.45;
          const px = cx + Math.cos(a) * rad;
          const py = cy + Math.sin(a) * rad;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'C': {
        // Sweep burst: 8 rays, alternating long/short.
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI) / 4;
          const len = i % 2 === 0 ? r : r * 0.55;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(a) * r * 0.25, cy + Math.sin(a) * r * 0.25);
          ctx.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len);
          ctx.stroke();
        }
        break;
      }
    }
  }

  function drawItems(state: GameState, timeMs: number): void {
    state.items.forEach((item, i) => {
      if (item.collected) return;
      const cx = (item.cell.x + 0.5) * CELL_PX;
      // Gentle bob, phase-shifted per item so they don't move in lockstep.
      const bob = Math.sin(timeMs / 320 + i * 1.7) * CELL_PX * 0.25;
      const cy = (item.cell.y + 0.5) * CELL_PX + bob;
      const s = CELL_PX * 4;
      const color = ITEM_COLOR[item.code];
      const pulse = 6 + 3 * Math.sin(timeMs / 240 + i);

      ctx.fillStyle = COLORS.itemBox;
      ctx.strokeStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = pulse;
      ctx.lineWidth = 1.5;
      ctx.fillRect(cx - s / 2, cy - s / 2, s, s);
      ctx.strokeRect(cx - s / 2, cy - s / 2, s, s);
      ctx.shadowBlur = 0;

      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      drawItemGlyph(item.code, cx, cy, CELL_PX * 1.35);
    });
  }

  return {
    beforeTick(): void {
      const state = getState();
      prevBoss = { x: state.boss.pos.x, y: state.boss.pos.y };
      prevWanderers.clear();
      for (const m of state.minions) {
        if (m.kind === 'wanderer' && m.alive) prevWanderers.set(m.id, { x: m.pos.x, y: m.pos.y });
      }
      prevProjectiles.clear();
      for (const s of state.projectiles) prevProjectiles.set(s.id, { x: s.pos.x, y: s.pos.y });
      prevSparks = state.sparks.map((s) => s.trailIndex);
      prevLasers = state.lasers.map((l) => ({ x: l.pos.x, y: l.pos.y }));
    },

    drawFrame(timeMs: number, alpha = 1): void {
      const state = getState();
      if (state.grid !== staticGrid) {
        // New stage: drop interpolation state so nothing glides across the field.
        resetInterpolation();
      }
      if (state.gridVersion !== staticVersion || state.grid !== staticGrid) {
        redrawStatic(state);
        staticVersion = state.gridVersion;
        staticGrid = state.grid;
      }
      ctx.drawImage(staticLayer, 0, 0);
      drawItems(state, timeMs);
      drawTrail(state);
      drawSparks(state, alpha);
      drawMinions(state, timeMs, alpha);
      drawBoss(state, timeMs, alpha);
      drawProjectiles(state, alpha);
      drawLasers(state, alpha);
      drawPlayer(state, timeMs, alpha);
    },
    getStaticRedrawCount: () => staticRedraws,
  };
}
