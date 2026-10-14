import { fullHdScale, graphicsCapabilities } from "./GraphicsQuality";
import type { GameInstance, GameConfig, GameMetrics } from "./GameSDK";
import { is3DGame } from "./GameSDK";
import { InputManager } from "./InputManager";
import { recordMeasurement } from "../services/performance";
export class GameEngine {
  private ctx: CanvasRenderingContext2D | null = null;
  private renderScale = 1;
  private game: GameInstance | null = null;
  private input = new InputManager();
  private destroyed = false;
  private isRunning = false;
  private isPaused = false;
  private ended = false;
  private frame: number | null = null;
  private lastTime = 0;
  private lastRenderTime = 0;
  private nextRenderTime = 0;
  private readonly step = 1000 / 60;
  private accumulator = 0;
  private samples: number[] = [];
  private launchMs = 0;
  private slug = "";
  private pauseHeld = false;
  private pauseCallback?: () => void;
  private overCallback?: (score: number) => void;
  private errorCallback?: (error: Error) => void;
  async init(
    canvas: HTMLCanvasElement,
    game: GameInstance,
    config: GameConfig,
  ): Promise<void> {
    if (this.destroyed) throw new Error("Engine was disposed");
    const started = performance.now();
    this.slug = config.slug;
    this.game = game;
    // Stable logical dimensions: resizing the browser scales the playfield without changing its rules.
    canvas.width = config.width ?? 960;
    canvas.height = config.height ?? 640;
    this.ctx = is3DGame(game)
      ? null
      : canvas.getContext("2d", {
          alpha: false,
          desynchronized: true,
          // A software GPU adds expensive raster/transfer work to these small 2D canvases.
          willReadFrequently: graphicsCapabilities().software,
        });
    if (!is3DGame(game) && !this.ctx)
      throw new Error("Canvas rendering is unavailable");
    try {
      await game.init(canvas, config);
      if (this.destroyed) {
        game.destroy?.();
        return;
      }
      if (!is3DGame(game)) {
        // Games capture logical dimensions during init; backing resolution must not alter rules or saves.
        const width = config.width ?? 960,
          height = config.height ?? 640;
        this.renderScale = fullHdScale(width, height);
        canvas.width = Math.round(width * this.renderScale);
        canvas.height = Math.round(height * this.renderScale);
      }
      this.render();
      this.launchMs = performance.now() - started;
    } catch (err) {
      game.destroy?.();
      throw err;
    }
  }
  start(): void {
    if (this.destroyed || this.isRunning || !this.game) return;
    this.isRunning = true;
    this.isPaused = false;
    this.ended = false;
    this.lastTime = performance.now();
    this.lastRenderTime = this.lastTime;
    this.nextRenderTime = this.lastTime + this.step;
    this.accumulator = 0;
    this.input.start();
    this.frame = requestAnimationFrame(this.loop);
  }
  stop(): void {
    this.isRunning = false;
    this.input.stop();
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
  }
  pause(): void {
    if (!this.isRunning || this.isPaused) return;
    this.isPaused = true;
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
    this.input.stop();
    this.game?.onPause?.();
    this.pauseCallback?.();
  }
  resume(): void {
    if (!this.isRunning || !this.isPaused) return;
    this.isPaused = false;
    this.lastTime = performance.now();
    this.lastRenderTime = this.lastTime;
    this.nextRenderTime = this.lastTime + this.step;
    this.accumulator = 0;
    this.input.start();
    this.game?.onResume?.();
    this.schedule();
  }
  togglePause(): void {
    if (this.isPaused) this.resume();
    else this.pause();
  }
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.stop();
    recordMeasurement(this.slug, this.launchMs, this.samples, {
      targetFps: 60,
      ...(this.game?.getRenderInfo?.() ?? {
        renderer: graphicsCapabilities().software
          ? "Canvas 2D · CPU raster"
          : "Canvas 2D · browser acceleration",
        quality: "1080p · full detail",
        width: this.ctx?.canvas?.width,
        height: this.ctx?.canvas?.height,
      }),
    });
    this.game?.destroy?.();
    this.game = null;
    this.ctx = null;
  }
  getMetrics(): GameMetrics {
    return { ...this.game?.getMetrics?.(), ended: this.ended };
  }
  getScore(): number {
    const value = this.game?.getScore?.() ?? 0;
    return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  }
  get recoverable(): boolean {
    return (this.game as GameInstance)?.getStatus?.() === "recoverable";
  }
  recover(): void {
    if (!this.recoverable) return;
    (this.game as GameInstance).recover?.();
    this.accumulator = 0;
    this.start();
  }
  getResult(): { title: string; detail: string } | null {
    return "getResult" in (this.game ?? {})
      ? ((this.game as GameInstance).getResult?.() ?? null)
      : null;
  }
  get canSave(): boolean {
    return !!(this.game?.getState && this.game?.setState);
  }
  getState(): Record<string, unknown> {
    if (!this.canSave) throw new Error("This game does not support saves");
    return this.game!.getState!();
  }
  setState(state: Record<string, unknown>): void {
    if (!this.canSave) throw new Error("This game does not support saves");
    this.game!.setState!(state);
    this.render();
  }
  onPause(callback: () => void): void {
    this.pauseCallback = callback;
  }
  onGameOver(callback: (score: number) => void): void {
    this.overCallback = callback;
  }
  onError(callback: (error: Error) => void): void {
    this.errorCallback = callback;
  }
  get paused(): boolean {
    return this.isPaused;
  }
  get running(): boolean {
    return this.isRunning;
  }
  private render(): void {
    if (!this.game) return;
    if (is3DGame(this.game)) this.game.render();
    else if (this.ctx) {
      this.ctx.setTransform(this.renderScale, 0, 0, this.renderScale, 0, 0);
      this.game.render(this.ctx);
    }
  }
  private loop = (now: number): void => {
    this.frame = null;
    if (!this.isRunning || this.isPaused || this.destroyed) return;
    try {
      this.accumulator += Math.max(0, Math.min(now - this.lastTime, 100));
      this.lastTime = now;
      // Keep the render clock separate from simulation catch-up. The small tolerance
      // handles RAF timestamp rounding at 60 Hz without extra draws at 120/144 Hz.
      if (now < this.nextRenderTime - 0.5) {
        this.schedule();
        return;
      }
      this.nextRenderTime +=
        Math.max(1, Math.floor((now - this.nextRenderTime) / this.step) + 1) *
        this.step;
      const input = this.input.getState();
      if (input.pause && !this.pauseHeld) {
        this.pauseHeld = true;
        this.pause();
        return;
      }
      this.pauseHeld = input.pause;
      let stepInput = input;
      while (this.accumulator + 0.000001 >= this.step) {
        this.accumulator = Math.max(0, this.accumulator - this.step);
        this.input.consumePresses();
        if (!this.game?.update(this.step, stepInput)) {
          this.sampleFrame(now);
          this.render();
          const score = this.getScore();
          this.ended = true;
          this.stop();
          this.overCallback?.(score);
          return;
        }
        if (this.accumulator + 0.000001 >= this.step)
          stepInput = this.input.getState();
      }
      this.sampleFrame(now);
      this.render();
      this.schedule();
    } catch (err) {
      this.stop();
      this.errorCallback?.(err instanceof Error ? err : new Error(String(err)));
    }
  };
  private schedule(): void {
    if (
      this.isRunning &&
      !this.isPaused &&
      !this.destroyed &&
      this.frame === null
    )
      this.frame = requestAnimationFrame(this.loop);
  }
  private sampleFrame(now: number): void {
    this.samples.push(Math.max(0, now - this.lastRenderTime));
    this.lastRenderTime = now;
    if (this.samples.length > 3600) this.samples.shift();
  }
}
