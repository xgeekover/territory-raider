import { CellState } from '../../engine/core/types';
import type { GameState } from '../../engine/core/gameState';
import {
  BOSS_RADIUS,
  CELL_PX,
  WANDERER_RADIUS,
} from '../../engine/config/constants';

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
  itemBorder: '#22d3ee',
  itemText: '#a5f3fc',
} as const;

export interface Renderer {
  drawFrame(timeMs: number): void;
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

  function drawPlayer(state: GameState, timeMs: number): void {
    const p = state.player;
    if (p.invincibleFor > 0 && Math.floor(timeMs / 100) % 2 === 0) return; // blink
    const color = p.mode === 'drawing' ? COLORS.playerDrawing : COLORS.player;
    const cx = (p.pos.x + 0.5) * CELL_PX;
    const cy = (p.pos.y + 0.5) * CELL_PX;
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

  function drawBoss(state: GameState, timeMs: number): void {
    const b = state.boss;
    if (!b.alive) return;
    const cx = b.pos.x * CELL_PX;
    const cy = b.pos.y * CELL_PX;
    const r = BOSS_RADIUS * CELL_PX;
    const spin = timeMs / 400;
    ctx.shadowColor = COLORS.boss;
    ctx.shadowBlur = 14;
    ctx.strokeStyle = COLORS.boss;
    ctx.fillStyle = COLORS.bossCore;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = spin + (i * Math.PI) / 3;
      const px = cx + Math.cos(a) * r;
      const py = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  function drawMinions(state: GameState, timeMs: number): void {
    for (const m of state.minions) {
      if (!m.alive) continue;
      if (m.kind === 'wanderer') {
        const cx = m.pos.x * CELL_PX;
        const cy = m.pos.y * CELL_PX;
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
        const pulse = 1 + 0.15 * Math.sin(timeMs / 120);
        const s = CELL_PX * 1.4 * pulse;
        const cx = (m.cell.x + 0.5) * CELL_PX;
        const cy = (m.cell.y + 0.5) * CELL_PX;
        ctx.shadowColor = COLORS.crawler;
        ctx.shadowBlur = 8;
        ctx.fillStyle = COLORS.crawler;
        ctx.fillRect(cx - s / 2, cy - s / 2, s, s);
        ctx.shadowBlur = 0;
      }
    }
  }

  function drawSparks(state: GameState): void {
    for (const s of state.sparks) {
      const i = Math.min(Math.floor(s.trailIndex), state.trail.cells.length - 1);
      const cell = state.trail.cells[i];
      if (!cell) continue;
      const cx = (cell.x + 0.5) * CELL_PX;
      const cy = (cell.y + 0.5) * CELL_PX;
      ctx.shadowColor = COLORS.spark;
      ctx.shadowBlur = 12;
      ctx.fillStyle = COLORS.spark;
      ctx.beginPath();
      ctx.arc(cx, cy, CELL_PX * 0.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  function drawLasers(state: GameState): void {
    ctx.strokeStyle = COLORS.laser;
    ctx.shadowColor = COLORS.laser;
    ctx.shadowBlur = 10;
    ctx.lineWidth = 2;
    for (const l of state.lasers) {
      const cx = l.pos.x * CELL_PX;
      const cy = l.pos.y * CELL_PX;
      const dx = l.dir === 'left' ? -1 : l.dir === 'right' ? 1 : 0;
      const dy = l.dir === 'up' ? -1 : l.dir === 'down' ? 1 : 0;
      const len = CELL_PX * 3;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx - dx * len, cy - dy * len);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
  }

  function drawItems(state: GameState): void {
    ctx.font = `bold ${CELL_PX * 2.4}px ui-monospace, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const item of state.items) {
      if (item.collected) continue;
      const cx = (item.cell.x + 0.5) * CELL_PX;
      const cy = (item.cell.y + 0.5) * CELL_PX;
      const s = CELL_PX * 4;
      ctx.fillStyle = COLORS.itemBox;
      ctx.strokeStyle = COLORS.itemBorder;
      ctx.shadowColor = COLORS.itemBorder;
      ctx.shadowBlur = 8;
      ctx.lineWidth = 1.5;
      ctx.fillRect(cx - s / 2, cy - s / 2, s, s);
      ctx.strokeRect(cx - s / 2, cy - s / 2, s, s);
      ctx.shadowBlur = 0;
      ctx.fillStyle = COLORS.itemText;
      ctx.fillText(item.code, cx, cy + 1);
    }
  }

  return {
    drawFrame(timeMs: number): void {
      const state = getState();
      if (state.gridVersion !== staticVersion || state.grid !== staticGrid) {
        redrawStatic(state);
        staticVersion = state.gridVersion;
        staticGrid = state.grid;
      }
      ctx.drawImage(staticLayer, 0, 0);
      drawItems(state);
      drawTrail(state);
      drawSparks(state);
      drawMinions(state, timeMs);
      drawBoss(state, timeMs);
      drawLasers(state);
      drawPlayer(state, timeMs);
    },
    getStaticRedrawCount: () => staticRedraws,
  };
}
