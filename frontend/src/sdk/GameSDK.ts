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
    difficulty?: 'easy' | 'normal' | 'hard';
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
    action: boolean;    // Space / Enter
    cancel: boolean;    // Escape

    // Additional
    pause: boolean;     // P or Escape

    // Raw key map for custom bindings
    keys: Record<string, boolean>;
}

/** Game type discriminator */
export type GameType = '2d' | '3d';

/** Base interface for all games */
interface GameInstanceBase {
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

    /** Get current score (for stats) */
    getScore?(): number;
}

/** 2D Canvas game interface */
export interface Game2DInstance extends GameInstanceBase {
    readonly type: '2d';

    /** Called once when game starts - receives canvas for 2D context */
    init(canvas: HTMLCanvasElement, config: GameConfig): void | Promise<void>;

    /** Called every frame after update to render (2D context) */
    render(ctx: CanvasRenderingContext2D): void;
}

/** 3D WebGL game interface */
export interface Game3DInstance extends GameInstanceBase {
    readonly type: '3d';

    /** Called once when game starts - receives canvas for WebGL */
    init(canvas: HTMLCanvasElement, config: GameConfig): void | Promise<void>;

    /** Called every frame after update (3D games handle their own rendering) */
    render(): void;
}

/** Union type for any game instance */
export type GameInstance = Game2DInstance | Game3DInstance;

/** Legacy backwards-compatible interface (defaults to 2D) */
export interface LegacyGameInstance {
    init(canvas: HTMLCanvasElement, config?: GameConfig): void | Promise<void>;
    update(deltaTime: number, input: InputState): boolean;
    render(ctx?: CanvasRenderingContext2D): void;
    onPause?(): void;
    onResume?(): void;
    destroy?(): void;
    getState?(): Record<string, unknown>;
    setState?(state: Record<string, unknown>): void;
    getScore?(): number;
}

/** Check if a game is 2D */
export function is2DGame(game: GameInstance | LegacyGameInstance): game is Game2DInstance {
    return 'type' in game ? game.type === '2d' : true; // Legacy defaults to 2D
}

/** Check if a game is 3D */
export function is3DGame(game: GameInstance | LegacyGameInstance): game is Game3DInstance {
    return 'type' in game && game.type === '3d';
}

/** Game factory function type */
export type GameFactory = () => GameInstance | LegacyGameInstance;

/** Registry of available games */
const gameRegistry: Map<string, GameFactory> = new Map();

/** Register a game with the SDK */
export function registerGame(slug: string, factory: GameFactory): void {
    gameRegistry.set(slug, factory);
    console.log(`[GameSDK] Registered game: ${slug}`);
}

/** Get a game instance by slug */
export function getGame(slug: string): GameInstance | LegacyGameInstance | null {
    const factory = gameRegistry.get(slug);
    if (!factory) {
        console.warn(`[GameSDK] Game not found: ${slug}`);
        return null;
    }
    return factory();
}

/** Check if a game is registered */
export function hasGame(slug: string): boolean {
    return gameRegistry.has(slug);
}

/** List all registered games */
export function listGames(): string[] {
    return Array.from(gameRegistry.keys());
}
