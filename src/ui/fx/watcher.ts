/**
 * Frame-by-frame state differ: watches the (untouched) engine state and turns
 * transitions into juice — particles, popups, flashes, shakes and sounds.
 * The engine publishes no events; everything here is derived by diffing, so
 * the engine and its 72 tests stay byte-identical.
 */
import type { GameState } from '../../engine/core/gameState';
import type { ItemCode } from '../../engine/core/types';
import { CELL_PX } from '../../engine/config/constants';
import { bossRageLevel } from '../../engine/systems/bossAttack';
import type { Fx } from './fx';
import type { AudioSystem } from './audio';

const ITEM_LABEL: Record<ItemCode, string> = {
  T: 'FREEZE',
  S: 'SPEED UP',
  L: 'LASER +5',
  P: '+5,000',
  C: 'SWEEP',
};

const CYAN = '#22d3ee';
const FUCHSIA = '#e879f9';
const ROSE = '#fb7185';
const GOLD = '#fde047';
const WHITE = '#f0fdff';

export interface Watcher {
  /** Call once per frame after the engine ticks; dt is the frame delta (s). */
  scan(state: GameState, fx: Fx, audio: AudioSystem, dt: number): void;
}

export function createWatcher(): Watcher {
  let initialized = false;
  let prevStatus: GameState['status'] = 'title';
  let prevScore = 0;
  let prevLives = 0;
  let prevGridVersion = 0;
  let prevLaserAmmo = 0;
  let prevSparkCount = 0;
  let prevBossAlive = true;
  let prevItems: GameState['items'] | null = null;
  let prevCollected: boolean[] = [];
  // Movement-feel state: afterimages + cutting sparks are emitted on timers,
  // and the pre-commit trail array is retained so a claim can ignite its path
  // (the engine *replaces* trail.cells on commit, so the old array stays valid).
  let prevPlayerX = -1;
  let prevPlayerY = -1;
  let ghostTimer = 0;
  let cutSparkTimer = 0;
  let lastTrailCells: GameState['trail']['cells'] = [];
  // Elemental-hazard transitions (slow/stun rising edges; burn via score diff).
  let prevSlowedFor = 0;
  let prevStunnedFor = 0;
  // Boss battle: hp/rage transitions + projectile lifecycle (id → last pos).
  let prevBossHp = -1;
  let prevRage = 0;
  let prevShots = new Map<number, { x: number; y: number }>();

  function px(cellX: number, cellY: number): [number, number] {
    return [cellX * CELL_PX, cellY * CELL_PX];
  }

  return {
    scan(state, fx, audio, dt): void {
      const { status } = state;
      // The music loop follows the stage's elemental theme (cheap setter).
      audio.setTheme(state.stage.theme);

      if (!initialized || state.items !== prevItems) {
        // First frame, or a new stage swapped the entity arrays: resync silently.
        prevItems = state.items;
        prevCollected = state.items.map((it) => it.collected);
        prevBossHp = state.boss.hp;
        prevRage = 0;
        prevShots = new Map();
        if (!initialized) {
          initialized = true;
          prevStatus = status;
          prevScore = state.score;
          prevLives = state.lives;
          prevGridVersion = state.gridVersion;
          prevLaserAmmo = state.laserAmmo;
          prevSparkCount = state.sparks.length;
          prevBossAlive = state.boss.alive;
          return;
        }
      }

      // --- status transitions -------------------------------------------------
      if (status !== prevStatus) {
        if (status === 'playing' && (prevStatus === 'title' || prevStatus === 'stageClear')) {
          audio.play('confirm');
          audio.setMusic(true);
        } else if (status === 'stageClear') {
          audio.play('stageClear');
          fx.flash('#6ee7b7', 0.12);
        } else if (status === 'gameOver') {
          audio.play('gameOver');
          audio.setMusic(false);
        } else if (status === 'victory') {
          audio.play('victory');
          audio.setMusic(false);
        } else if (status === 'paused') {
          audio.play('pause');
          audio.setMusic(false); // silence while paused
        } else if (status === 'playing' && prevStatus === 'paused') {
          audio.play('pause');
          audio.setMusic(true);
        } else if (status === 'title') {
          audio.setMusic(false);
        }
      }

      if (status === 'playing') {
        // --- death ------------------------------------------------------------
        if (state.lives < prevLives) {
          const [x, y] = px(state.player.pos.x + 0.5, state.player.pos.y + 0.5);
          fx.burst(x, y, ROSE, 42, 150);
          fx.burst(x, y, WHITE, 14, 220);
          fx.flash('#881337', 0.28);
          fx.shake(9, 0.45);
          audio.play('death');
          lastTrailCells = []; // the aborted cut must not ignite on a later claim
        }

        // --- territory claimed (grid committed) --------------------------------
        // Every commit scores at least its trail cells, so a version bump with
        // NO score change is a fire-hazard burn (rollback), not a claim.
        if (
          state.gridVersion !== prevGridVersion &&
          state.lives >= prevLives &&
          state.score > prevScore
        ) {
          const delta = state.score - prevScore;
          const [x, y] = px(state.player.pos.x + 0.5, state.player.pos.y + 0.5);
          const big = delta >= 3000;
          fx.burst(x, y, CYAN, big ? 36 : 14, big ? 160 : 90);
          // Ignite the just-committed trail: cyan sparks sweep its whole path.
          const step = Math.max(1, Math.floor(lastTrailCells.length / 40));
          for (let i = 0; i < lastTrailCells.length; i += step) {
            const c = lastTrailCells[i]!;
            fx.sparks((c.x + 0.5) * CELL_PX, (c.y + 0.5) * CELL_PX, CYAN, 2, 60);
          }
          lastTrailCells = []; // consumed — a later claim ignites its own path only
          fx.popup(x, Math.max(12, y - 8), `+${delta.toLocaleString('en-US')}`, big ? GOLD : CYAN);
          if (big) fx.flash('#164e63', 0.14);
          audio.play(big ? 'bigClaim' : 'claim');
        }

        // --- fire hazard: the cut burned away (rollback without death/score) ----
        if (
          state.gridVersion !== prevGridVersion &&
          state.lives >= prevLives &&
          state.score === prevScore &&
          lastTrailCells.length > 0
        ) {
          const [x, y] = px(state.player.pos.x + 0.5, state.player.pos.y + 0.5);
          // Flames race down the lost path.
          const step = Math.max(1, Math.floor(lastTrailCells.length / 50));
          for (let i = 0; i < lastTrailCells.length; i += step) {
            const c = lastTrailCells[i]!;
            fx.sparks((c.x + 0.5) * CELL_PX, (c.y + 0.5) * CELL_PX, '#fb923c', 3, 90);
          }
          lastTrailCells = [];
          fx.burst(x, y, '#f97316', 22, 130);
          fx.popup(x, Math.max(12, y - 10), 'BURNED!', '#fb923c');
          fx.flash('#431407', 0.18);
          fx.shake(5, 0.3);
          audio.play('hazardBurn');
        }

        // --- ice / lightning hazard hits (rising edges) -------------------------
        if (state.player.slowedFor > prevSlowedFor) {
          const [x, y] = px(state.player.pos.x + 0.5, state.player.pos.y + 0.5);
          fx.burst(x, y, '#38bdf8', 14, 90);
          fx.popup(x, Math.max(12, y - 10), 'FROSTED', '#7dd3fc');
          fx.flash('#082f49', 0.14);
          audio.play('hazardSlow');
        }
        if (state.player.stunnedFor > prevStunnedFor) {
          const [x, y] = px(state.player.pos.x + 0.5, state.player.pos.y + 0.5);
          fx.burst(x, y, GOLD, 20, 150);
          fx.burst(x, y, WHITE, 8, 220);
          fx.popup(x, Math.max(12, y - 10), 'SHOCKED', GOLD);
          fx.flash('#422006', 0.16);
          fx.shake(6, 0.3);
          audio.play('hazardStun');
        }

        // --- item pickups -------------------------------------------------------
        state.items.forEach((item, i) => {
          if (item.collected && !prevCollected[i]) {
            const [x, y] = px(item.cell.x + 0.5, item.cell.y + 0.5);
            fx.burst(x, y, GOLD, 18, 110);
            fx.popup(x, Math.max(12, y - 10), ITEM_LABEL[item.code], GOLD);
            audio.play('item');
          }
        });

        // --- laser fired --------------------------------------------------------
        if (state.laserAmmo < prevLaserAmmo) {
          fx.shake(2, 0.1);
          audio.play('laser');
        }

        // --- a spark spawned onto the trail ------------------------------------
        if (state.sparks.length > prevSparkCount) {
          audio.play('sparkWarn');
        }

        // --- boss battle --------------------------------------------------------
        if (state.boss.alive) {
          // Laser connected: hit flash on the core.
          if (state.boss.hp < prevBossHp) {
            const [bx, by] = px(state.boss.pos.x, state.boss.pos.y);
            fx.burst(bx, by, WHITE, 12, 130);
            fx.popup(bx, Math.max(12, by - 16), `CORE ${state.boss.hp}/${state.stage.bossHp}`, FUCHSIA);
            audio.play('bossHit');
          }
          // Enrage tiers: the Core answers your progress.
          const rage = bossRageLevel(state);
          if (rage > prevRage) {
            const [bx, by] = px(state.boss.pos.x, state.boss.pos.y);
            fx.popup(bx, Math.max(12, by - 20), rage === 2 ? 'CORE FURY' : 'THE CORE AWAKENS', ROSE);
            fx.burst(bx, by, rage === 2 ? ROSE : '#fb923c', 26, 140);
            fx.flash(rage === 2 ? '#4c0519' : '#431407', 0.2);
            fx.shake(6, 0.35);
            audio.play('bossRage');
          }
          prevRage = rage;
        }

        // Projectile lifecycle: new ids → muzzle sound; vanished ids → splash
        // sparks where they died (skip when a death just cleared the volley).
        const shots = new Map<number, { x: number; y: number }>();
        let fired = false;
        for (const s of state.projectiles) {
          if (!prevShots.has(s.id)) fired = true;
          shots.set(s.id, { x: s.pos.x, y: s.pos.y });
        }
        if (fired) audio.play('bossShoot');
        if (state.lives >= prevLives) {
          for (const [id, pos] of prevShots) {
            if (!shots.has(id)) fx.sparks(pos.x * CELL_PX, pos.y * CELL_PX, ROSE, 5, 70);
          }
        }
        prevShots = shots;

        // Danger vignette while cutting into the dark.
        fx.setDanger(state.player.mode === 'drawing' ? (state.sparks.length > 0 ? 2 : 1) : 0);

        // --- movement feel: afterimages + cutting sparks ------------------------
        const pxNow = state.player.pos.x;
        const pyNow = state.player.pos.y;
        const moving =
          prevPlayerX >= 0 &&
          (Math.abs(pxNow - prevPlayerX) > 1e-4 || Math.abs(pyNow - prevPlayerY) > 1e-4);
        const drawing = state.player.mode === 'drawing';
        const [hx, hy] = px(pxNow + 0.5, pyNow + 0.5);

        if (moving) {
          ghostTimer -= dt;
          if (ghostTimer <= 0) {
            // Drawing leaves a hotter, denser fuchsia wake; frontier walking a cool cyan one.
            ghostTimer = drawing ? 0.035 : 0.06;
            fx.ghost(hx, hy, CELL_PX * 1.1, drawing ? '#f0abfc' : '#22d3ee');
          }
        }
        if (drawing && moving) {
          cutSparkTimer -= dt;
          if (cutSparkTimer <= 0) {
            cutSparkTimer = 0.04;
            // The cutting head grinds against the dark: fuchsia/white embers.
            fx.sparks(hx, hy, Math.random() < 0.3 ? WHITE : '#e879f9', 2, 52);
          }
        }
        prevPlayerX = pxNow;
        prevPlayerY = pyNow;
      } else {
        fx.setDanger(0);
        prevPlayerX = -1;
        prevPlayerY = -1;
      }

      // --- boss destroyed (annexation may flip status in the same tick) --------
      if (prevBossAlive && !state.boss.alive) {
        const [x, y] = px(state.boss.pos.x, state.boss.pos.y);
        fx.burst(x, y, FUCHSIA, 70, 210);
        fx.burst(x, y, WHITE, 24, 300);
        fx.flash('#f5d0fe', 0.3);
        fx.shake(13, 0.7);
        audio.play('bossKill');
      }

      prevStatus = status;
      prevScore = state.score;
      prevLives = state.lives;
      prevSlowedFor = state.player.slowedFor;
      prevStunnedFor = state.player.stunnedFor;
      prevGridVersion = state.gridVersion;
      prevLaserAmmo = state.laserAmmo;
      prevSparkCount = state.sparks.length;
      prevBossAlive = state.boss.alive;
      prevBossHp = state.boss.hp;
      prevCollected = state.items.map((it) => it.collected);
      // Keep the live array reference: on commit the engine swaps in a fresh
      // array, so this still points at the full pre-commit path next frame.
      if (state.trail.cells.length > 0) lastTrailCells = state.trail.cells;
    },
  };
}
