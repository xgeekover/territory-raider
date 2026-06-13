/**
 * Lightweight frame-rate sampler (spec M6 performance check). Tracks a rolling
 * FPS estimate and exposes the renderer's static-layer redraw count so the
 * HUD can prove the two-layer strategy: redraws should match the number of
 * trail commits, not the frame count.
 */
export interface PerfSample {
  fps: number;
  staticRedraws: number;
}

export class PerfMonitor {
  private frames = 0;
  private elapsed = 0;
  private fps = 0;

  /** Feed each frame's delta (seconds); returns the current 1Hz-smoothed FPS. */
  tick(frameDt: number): number {
    this.frames++;
    this.elapsed += frameDt;
    if (this.elapsed >= 0.5) {
      this.fps = Math.round(this.frames / this.elapsed);
      this.frames = 0;
      this.elapsed = 0;
    }
    return this.fps;
  }

  get currentFps(): number {
    return this.fps;
  }
}
