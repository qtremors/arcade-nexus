/**
 * Game Engine - Manages game loop and lifecycle
 * Supports both 2D (Canvas) and 3D (WebGL/Three.js) games
 */
import type { GameInstance, LegacyGameInstance, GameConfig } from './GameSDK';
import { is3DGame } from './GameSDK';
import { InputManager } from './InputManager';

export class GameEngine {
    private ctx: CanvasRenderingContext2D | null = null;
    private game: GameInstance | LegacyGameInstance | null = null;
    private config: GameConfig | null = null;
    private is3D = false;

    private inputManager: InputManager;
    private isRunning = false;
    private isPaused = false;
    private animationFrameId: number | null = null;
    private lastTime = 0;
    private wasPausePressed = false;

    private onPauseCallback?: () => void;
    private onGameOverCallback?: (score: number) => void;

    constructor() {
        this.inputManager = new InputManager();
        this.gameLoop = this.gameLoop.bind(this);
    }

    /** Initialize the engine with a canvas element */
    async init(
        canvas: HTMLCanvasElement,
        game: GameInstance | LegacyGameInstance,
        config: GameConfig
    ): Promise<void> {
        this.game = game;
        this.config = config;
        this.is3D = is3DGame(game as GameInstance);

        // Set canvas size
        canvas.width = config.width || 800;
        canvas.height = config.height || 600;

        if (this.is3D) {
            // 3D games manage their own WebGL context
            this.ctx = null;
            console.log('[GameEngine] Initializing 3D game');
        } else {
            // 2D games use Canvas 2D context
            this.ctx = canvas.getContext('2d');
            if (!this.ctx) {
                throw new Error('Failed to get 2D context from canvas');
            }
            console.log('[GameEngine] Initializing 2D game');
        }

        // Initialize the game
        await this.game.init(canvas, config);
    }

    /** Start the game loop */
    start(): void {
        if (this.isRunning) return;

        this.isRunning = true;
        this.isPaused = false;
        this.lastTime = performance.now();

        this.inputManager.start();
        this.animationFrameId = requestAnimationFrame(this.gameLoop);

        this.log(`[GameEngine] Started: ${this.config?.slug}`);
    }

    /** Stop the game loop */
    stop(): void {
        this.isRunning = false;
        this.inputManager.stop();

        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        this.log(`[GameEngine] Stopped: ${this.config?.slug}`);
    }

    /** Pause the game */
    pause(): void {
        if (!this.isRunning || this.isPaused) return;

        this.isPaused = true;
        this.game?.onPause?.();
        this.onPauseCallback?.();

        this.log(`[GameEngine] Paused: ${this.config?.slug}`);
    }

    /** Resume from pause */
    resume(): void {
        if (!this.isRunning || !this.isPaused) return;

        this.isPaused = false;
        this.lastTime = performance.now(); // Reset time to avoid jump
        this.game?.onResume?.();

        this.log(`[GameEngine] Resumed: ${this.config?.slug}`);
    }

    /** Toggle pause state */
    togglePause(): void {
        if (this.isPaused) {
            this.resume();
        } else {
            this.pause();
        }
    }

    /** Destroy the engine and clean up */
    destroy(): void {
        this.stop();
        this.game?.destroy?.();
        this.game = null;
        this.ctx = null;
        this.config = null;
    }

    /** Get current game score */
    getScore(): number {
        return this.game?.getScore?.() || 0;
    }

    /** Get current game state */
    getState(): Record<string, unknown> {
        return this.game?.getState?.() || {};
    }

    /** Restore game state */
    setState(state: Record<string, unknown>): void {
        this.game?.setState?.(state);
    }

    /** Set pause callback */
    onPause(callback: () => void): void {
        this.onPauseCallback = callback;
    }

    /** Set game over callback */
    onGameOver(callback: (score: number) => void): void {
        this.onGameOverCallback = callback;
    }

    /** Check if game is paused */
    get paused(): boolean {
        return this.isPaused;
    }

    /** Check if game is running */
    get running(): boolean {
        return this.isRunning;
    }

    /** Main game loop */
    private gameLoop(currentTime: number): void {
        if (!this.isRunning) return;

        // Request next frame immediately
        this.animationFrameId = requestAnimationFrame(this.gameLoop);

        // Skip if paused
        if (this.isPaused) return;

        // Calculate delta time in MILLISECONDS (games expect ms)
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;

        // Cap delta time to prevent spiral of death (100ms max)
        const cappedDelta = Math.min(deltaTime, 100);

        // Get input state
        const input = this.inputManager.getState();

        // Check for pause input
        if (input.pause && !this.wasPausePressed) {
            this.pause();
            this.wasPausePressed = true;
            return;
        }
        if (!input.pause) {
            this.wasPausePressed = false;
        }

        // Update game - returns false if game is over
        const continueGame = this.game?.update(cappedDelta, input) ?? false;

        // Render game
        if (this.is3D) {
            // 3D games handle their own rendering
            (this.game as { render: () => void })?.render();
        } else if (this.ctx) {
            // 2D games use canvas context
            (this.game as { render: (ctx: CanvasRenderingContext2D) => void })?.render(this.ctx);
        }

        // Check game over
        if (!continueGame) {
            const score = this.getScore();
            this.log(`[GameEngine] Game Over! Score: ${score}`);
            this.onGameOverCallback?.(score);
            this.stop();
        }
    }

    /** Log only in development mode */
    private log(message: string): void {
        if (import.meta.env.DEV) {
            console.log(message);
        }
    }
}
