# Territory Raider

A Volfied/Qix-style **territory-capture** game built with **React 18 + TypeScript (strict) + Canvas 2D** — no game-engine libraries. Cut into the dark, fence off the boss, and claim 80% of the field across 8 escalating stages.

The name, art, and audio are original; only the genre mechanics are borrowed. All visuals are shape-and-code generated on a dark zinc/slate palette with cyan/fuchsia neon accents.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # headless engine unit tests (Vitest)
npm run build      # tsc --noEmit + production build
npm run typecheck  # tsc --noEmit only
```

## Controls

| Key | Action |
|---|---|
| **Arrow keys** | Move along the claimed frontier (shield mode) |
| **Space (hold)** | Cut a trail into unclaimed space (drawing mode) |
| **X** | Fire a laser (shield mode, needs the `L` item) |
| **P** | Pause / resume |
| **Enter** | Start · advance after a stage clear · restart |

## How it plays

- You start **shielded**, walking only on boundary cells (claimed/border cells that touch the dark). Shielded, nothing can kill you.
- Hold **Space** and step into the dark to start **drawing** a trail. Close the loop back onto claimed ground and the enclosed region is captured.
- Capture works by flood-filling from the **boss**: whichever side the boss is *not* trapped in stays dark, everything else becomes yours. Minions caught inside die for a trap bonus.
- While drawing you are vulnerable — enemy contact, or a **spark** crawling up your trail, costs a life.
- Pick up items by enclosing their tiles: **T** freeze, **S** speed, **L** laser charges, **P** points, **C** clear minions.
- Reach **80%** to clear the stage. Kill the boss with the laser to annex the whole field instantly for a big bonus.

## Architecture

The engine is a **pure TypeScript module with zero React/DOM dependencies**, so it runs headless under Vitest. React only subscribes to an immutable HUD snapshot; it never holds per-frame game state.

```
                       ┌─────────────────────────────────────────┐
                       │            engine (pure TS)              │
                       │                                          │
  InputState  ───────▶ │  tick(input, dt)                         │
  (held keys)          │    movement → claim → laser              │
                       │    → enemies → spark → collision → death │
                       │                                          │
  EngineAction ──────▶ │  dispatch(action)   (Enter/P/X)          │
                       │                                          │
                       │  GameState  (grid Uint8Array, player,    │
                       │   boss, minions, sparks, lasers, items)  │
                       │                                          │
                       │  subscribe / getSnapshot  ◀── publishes  │
                       │       only when a HUD value changes      │
                       └───────┬───────────────────────┬──────────┘
                               │ getState()            │ getSnapshot()
                               ▼ (live, for render)    ▼ (useSyncExternalStore)
                    ┌──────────────────────┐   ┌────────────────────────┐
                    │  renderer (Canvas 2D)│   │  React HUD / screens   │
                    │  static layer:       │   │  Hud, Title, Pause,    │
                    │   redrawn ONLY on a  │   │  StageClear, GameOver  │
                    │   trail commit       │   │  (re-render on value   │
                    │  dynamic layer:      │   │   change, not frame)   │
                    │   drawn every frame  │   └────────────────────────┘
                    └──────────────────────┘
                               ▲
                    requestAnimationFrame + 60Hz fixed-timestep
                    accumulator (dt clamped to avoid tunneling)
```

### Directory layout

```
src/
  engine/
    core/      types.ts · grid.ts · gameState.ts · rng.ts
    systems/   movement.ts · claim.ts · enemies.ts · spark.ts
               items.ts · laser.ts · collision.ts · scoring.ts
    config/    constants.ts · stages.ts
    index.ts   createEngine(): { tick, dispatch, subscribe, getSnapshot, getState }
  ui/
    components/ GameCanvas · Hud · TitleScreen · PauseOverlay
                StageClearScreen · GameOverScreen · VictoryScreen
    hooks/      useGameEngine · useKeyboard · useRafLoop
    render/     renderer.ts · perf.ts
  App.tsx · main.tsx
tests/engine/  unit tests (headless, DOM-free)
```

### Design rules enforced here

- **Engine owns the state, outside React.** `useSyncExternalStore` reads a HUD snapshot that the engine republishes *only when a value changes*, so HUD components don't re-render per frame.
- **Fixed timestep.** `requestAnimationFrame` drives a 60Hz accumulator; the frame delta is clamped (`MAX_FRAME_DT`) so returning from a hidden tab can't flood the loop and tunnel entities through walls. No `setInterval`.
- **Two-layer rendering.** The grid (claimed/unclaimed/border) is rasterized into an offscreen canvas and redrawn **only on a trail commit** (tracked by `gridVersion`); every frame blits that layer once and draws moving entities on top.
- **O(1) collisions.** All hit tests are cell-indexed or per-enemy distance checks — no O(n²) entity scans.
- **SOLID.** Each `systems/*` file has one responsibility; the engine core never imports the renderer. Enemy behavior is a per-kind table, so a new enemy type is one state variant plus one entry (OCP).
- **`strict: true`, no `any`, no magic numbers** — all tuning lives in `engine/config/constants.ts`; per-stage difficulty in `stages.ts`.

### The claim algorithm (`systems/claim.ts`)

On commit: trail → claimed; flood-fill unclaimed cells from the boss's cell; every unclaimed cell the fill *couldn't* reach becomes claimed. Slivers (1-cell gaps left by parallel trails) fall out of the flood fill automatically — no special-case code. If the boss is already dead there's no seed, so the whole field is claimed and the stage clears.

## Performance

- Target is a steady **60 fps**. In `npm run dev` a corner overlay shows live FPS and the running **static-layer redraw count** — the redraw count should track the number of trail commits, never the frame count, proving the two-layer cache works. The renderer also logs each static redraw to the console in dev.
- The fixed-timestep loop decouples simulation from frame rate, so physics stays stable even if rendering dips.

## Testing

68 headless engine tests cover the spec-critical paths: the flood-fill claim (boss on each side, 1-cell slivers, boss-dead full claim, over-80% bonus), trail rules (self-cross/backtrack blocks, commit conversion), enemy movement and containment, collisions and death rollback (ratio invariant), spark pathing, laser hits and boss-kill clear, item once-only acquisition, and the engine lifecycle (title/pause/stage-carry/victory + snapshot-only-on-change).

```bash
npm test
```
