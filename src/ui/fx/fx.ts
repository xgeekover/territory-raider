/**
 * Canvas effects layer: particles, floating score popups, full-field flashes,
 * screen shake and the danger vignette. Draws onto its own overlay canvas so
 * the game renderer stays untouched; purely visual, holds no game state.
 */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number; // seconds remaining
  ttl: number; // initial life
  size: number;
  color: string;
  drag: number;
  /** 'spark' = filled square, 'ghost' = fading diamond outline (afterimage). */
  shape: 'spark' | 'ghost';
}

interface Popup {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  ttl: number;
}

interface Flash {
  color: string;
  alpha: number;
  decay: number; // alpha units per second
}

/** 0 = safe, 1 = drawing (exposed), 2 = drawing with a live spark hunting you. */
export type DangerLevel = 0 | 1 | 2;

export interface Fx {
  update(dt: number): void;
  draw(timeMs: number): void;
  burst(x: number, y: number, color: string, count: number, speed?: number): void;
  /** Short-lived fading diamond outline — motion afterimage for the player. */
  ghost(x: number, y: number, size: number, color: string): void;
  /** A few drifting sparks — continuous emission (cutting head, engine dust). */
  sparks(x: number, y: number, color: string, count: number, speed?: number): void;
  popup(x: number, y: number, text: string, color: string): void;
  flash(color: string, alpha: number): void;
  shake(magnitude: number, duration: number): void;
  /** Current shake offset in px — apply as a CSS translate on the play field. */
  getOffset(): { x: number; y: number };
  setDanger(level: DangerLevel): void;
}

export function createFx(canvas: HTMLCanvasElement): Fx {
  const c2d = canvas.getContext('2d');
  if (!c2d) throw new Error('2D canvas context unavailable');
  const ctx: CanvasRenderingContext2D = c2d;
  const W = canvas.width;
  const H = canvas.height;

  const particles: Particle[] = [];
  const popups: Popup[] = [];
  const flashes: Flash[] = [];
  let shakeMag = 0;
  let shakeFor = 0;
  let offset = { x: 0, y: 0 };
  let danger: DangerLevel = 0;
  let dangerBlend = 0; // eased 0..1 intensity so the vignette fades in/out

  return {
    burst(x, y, color, count, speed = 90): void {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = speed * (0.35 + Math.random() * 0.9);
        particles.push({
          x,
          y,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v,
          life: 0.5 + Math.random() * 0.5,
          ttl: 1,
          size: 1.5 + Math.random() * 2.5,
          color,
          drag: 2.2,
          shape: 'spark',
        });
      }
    },

    ghost(x, y, size, color): void {
      particles.push({
        x,
        y,
        vx: 0,
        vy: 0,
        life: 0.26,
        ttl: 0.26,
        size,
        color,
        drag: 0,
        shape: 'ghost',
      });
    },

    sparks(x, y, color, count, speed = 46): void {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = speed * (0.3 + Math.random());
        particles.push({
          x: x + (Math.random() * 2 - 1) * 2,
          y: y + (Math.random() * 2 - 1) * 2,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v,
          life: 0.2 + Math.random() * 0.25,
          ttl: 0.45,
          size: 1 + Math.random() * 1.8,
          color,
          drag: 3.5,
          shape: 'spark',
        });
      }
    },

    popup(x, y, text, color): void {
      popups.push({ x, y, text, color, life: 1.1, ttl: 1.1 });
    },

    flash(color, alpha): void {
      flashes.push({ color, alpha, decay: alpha / 0.3 });
    },

    shake(magnitude, duration): void {
      shakeMag = Math.max(shakeMag, magnitude);
      shakeFor = Math.max(shakeFor, duration);
    },

    getOffset: () => offset,

    setDanger(level): void {
      danger = level;
    },

    update(dt): void {
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]!;
        p.life -= dt;
        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }
        const damp = Math.max(0, 1 - p.drag * dt);
        p.vx *= damp;
        p.vy *= damp;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
      for (let i = popups.length - 1; i >= 0; i--) {
        const q = popups[i]!;
        q.life -= dt;
        q.y -= 22 * dt;
        if (q.life <= 0) popups.splice(i, 1);
      }
      for (let i = flashes.length - 1; i >= 0; i--) {
        const f = flashes[i]!;
        f.alpha -= f.decay * dt;
        if (f.alpha <= 0) flashes.splice(i, 1);
      }
      if (shakeFor > 0) {
        shakeFor -= dt;
        const m = shakeMag * Math.max(0, shakeFor) * 4;
        offset = { x: (Math.random() * 2 - 1) * m, y: (Math.random() * 2 - 1) * m };
        if (shakeFor <= 0) {
          shakeMag = 0;
          offset = { x: 0, y: 0 };
        }
      }
      // Ease the vignette toward its target so entering/leaving draw mode is smooth.
      const target = danger === 0 ? 0 : danger === 1 ? 0.55 : 1;
      dangerBlend += (target - dangerBlend) * Math.min(1, 6 * dt);
    },

    draw(timeMs): void {
      ctx.clearRect(0, 0, W, H);

      // Flashes under everything else on this layer.
      for (const f of flashes) {
        ctx.globalAlpha = Math.max(0, f.alpha);
        ctx.fillStyle = f.color;
        ctx.fillRect(0, 0, W, H);
      }
      ctx.globalAlpha = 1;

      // Danger vignette: pulsing edges while cutting into the dark.
      if (dangerBlend > 0.02) {
        const pulse = 0.85 + 0.15 * Math.sin(timeMs / (danger === 2 ? 90 : 220));
        const grad = ctx.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, H * 0.72);
        const color = danger === 2 ? '251,113,133' : '217,70,239'; // rose vs fuchsia
        grad.addColorStop(0, `rgba(${color},0)`);
        grad.addColorStop(1, `rgba(${color},${(0.22 * dangerBlend * pulse).toFixed(3)})`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
      }

      // Particles: additive blending for the neon feel.
      ctx.globalCompositeOperation = 'lighter';
      for (const p of particles) {
        const a = Math.max(0, p.life / p.ttl);
        if (p.shape === 'ghost') {
          // Afterimage: diamond outline that fades and slightly shrinks.
          const r = p.size * (0.7 + 0.3 * a);
          ctx.globalAlpha = a * 0.5;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y - r);
          ctx.lineTo(p.x + r, p.y);
          ctx.lineTo(p.x, p.y + r);
          ctx.lineTo(p.x - r, p.y);
          ctx.closePath();
          ctx.stroke();
        } else {
          ctx.globalAlpha = a;
          ctx.fillStyle = p.color;
          ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        }
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;

      // Floating score/item popups.
      if (popups.length > 0) {
        ctx.font = 'bold 13px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (const q of popups) {
          const a = Math.max(0, Math.min(1, q.life / q.ttl));
          ctx.globalAlpha = a;
          ctx.shadowColor = q.color;
          ctx.shadowBlur = 8;
          ctx.fillStyle = q.color;
          ctx.fillText(q.text, q.x, q.y);
        }
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      }
    },
  };
}
