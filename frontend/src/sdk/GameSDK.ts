/**
 * Game SDK - Blueprint interface for building games
 *
 * Supports both 2D (Canvas) and 3D (Three.js/WebGL) games.
 * All games must implement one of: Game2DInstance or Game3DInstance
 */

/** Game configuration from backend */
export interface GameConfig {
  slug: string;
  title: string;
  width?: number;
  height?: number;
  fps?: number;
  difficulty?: "easy" | "normal" | "hard";
  mode?: string;
  seed?: number;
  [key: string]: unknown;
}

/** Input state for keyboard/gamepad */
export interface InputState {
  // Arrow keys / WASD
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;

  // Action buttons
  action: boolean; // Space / Enter
  cancel: boolean; // Escape

  // Additional
  pause: boolean; // P or Escape

  // Raw key map for custom bindings
  keys: Record<string, boolean>;
  /** Presses consumed once per simulation step; axes retain analog magnitude. */
  pressed?: string[];
  axes?: { x: number; y: number };
  throttle?: number;
}

export type { GameMetrics } from "../contracts/gameplay";
import type { GameMetrics } from "../contracts/gameplay";
export interface GameRenderInfo {
  renderer?: string | null;
  quality?: string;
  targetFps?: number;
  width?: number;
  height?: number;
}
export type GameStatus = "playing" | "recoverable" | "complete";

export interface RenderDiagnostics {
  frame(): { calls: number; triangles: number };
  resources(): { geometries: number; textures: number };
  renderer: string | null;
  antialias: boolean;
}
export interface InputHints {
  snake?: {
    head: { x: number; y: number };
    direction: string;
    cols: number;
    rows: number;
  };
  raptor?: {
    obstacles: readonly { x: number; width: number; type: string }[];
    speed: number;
    jumping: boolean;
  };
  breakout?: { ballX: number; paddleX: number };
  prism?: {
    rows: readonly { z: number; safe: number; passed: boolean }[];
    lane: number;
  };
}

/** Game type discriminator */
export type GameType = "2d" | "3d";

/** Base interface for all games */
export interface GameInstanceBase {
  /** Narrow internal ports used by diagnostics without private-field access. */
  getRenderDiagnostics?(): RenderDiagnostics | null;
  getInputHints?(): InputHints;
  /** Game type - '2d' for Canvas, '3d' for Three.js */
  readonly type: GameType;

  /** Called every frame - return false to stop the game loop */
  update(deltaTime: number, input: InputState): boolean;

  /** Called when game is paused */
  onPause?(): void;

  /** Called when game resumes from pause */
  onResume?(): void;

  /** Called when game is destroyed/unmounted */
  destroy?(): void;

  /** Get current game state for saving */
  getState?(): Record<string, unknown>;

  /** Restore game from saved state */
  setState?(state: Record<string, unknown>): void;

  /** Bounded measurements used for local achievement qualification. */
  getMetrics?(): GameMetrics;
  getRenderInfo?(): GameRenderInfo;
  getStatus?(): GameStatus;
  recover?(): void;

  /** Get current score (for stats) */
  getScore?(): number;
  /** A game's own result copy rather than a generic failure screen. */
  getResult?(): { title: string; detail: string };
}

/** 2D Canvas game interface */
export interface Game2DInstance<
  TConfig extends GameConfig = GameConfig,
> extends GameInstanceBase {
  readonly type: "2d";

  /** Called once when game starts - receives canvas for 2D context */
  init(canvas: HTMLCanvasElement, config: TConfig): void | Promise<void>;

  /** Called every frame after update to render (2D context) */
  render(ctx: CanvasRenderingContext2D): void;
}

/** 3D WebGL game interface */
export interface Game3DInstance<
  TConfig extends GameConfig = GameConfig,
> extends GameInstanceBase {
  readonly type: "3d";

  /** Called once when game starts - receives canvas for WebGL */
  init(canvas: HTMLCanvasElement, config: TConfig): void | Promise<void>;

  /** Called every frame after update (3D games handle their own rendering) */
  render(): void;
}

/** Union type for any game instance */
export type GameInstance<TConfig extends GameConfig = GameConfig> =
  Game2DInstance<TConfig> | Game3DInstance<TConfig>;

/** Type guards used by the renderer. Games are loaded through descriptors. */
export function is2DGame(game: GameInstance): game is Game2DInstance {
  return game.type === "2d";
}
export function is3DGame(game: GameInstance): game is Game3DInstance {
  return game.type === "3d";
}
