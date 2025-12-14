/**
 * Input Manager - Handles keyboard and gamepad input
 */
import type { InputState } from './GameSDK';

export class InputManager {
    private keys: Record<string, boolean> = {};
    private gamepadIndex: number | null = null;

    constructor() {
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleKeyUp = this.handleKeyUp.bind(this);
        this.handleGamepadConnected = this.handleGamepadConnected.bind(this);
        this.handleGamepadDisconnected = this.handleGamepadDisconnected.bind(this);
    }

    /** Start listening for input events */
    start(): void {
        window.addEventListener('keydown', this.handleKeyDown);
        window.addEventListener('keyup', this.handleKeyUp);
        window.addEventListener('gamepadconnected', this.handleGamepadConnected);
        window.addEventListener('gamepaddisconnected', this.handleGamepadDisconnected);
    }

    /** Stop listening for input events */
    stop(): void {
        window.removeEventListener('keydown', this.handleKeyDown);
        window.removeEventListener('keyup', this.handleKeyUp);
        window.removeEventListener('gamepadconnected', this.handleGamepadConnected);
        window.removeEventListener('gamepaddisconnected', this.handleGamepadDisconnected);
        this.keys = {};
    }

    /** Get current input state */
    getState(): InputState {
        // Check gamepad input
        const gamepad = this.getGamepad();

        // Combine keyboard and gamepad input
        return {
            up: this.keys['ArrowUp'] || this.keys['KeyW'] || this.getGamepadButton(gamepad, 12),
            down: this.keys['ArrowDown'] || this.keys['KeyS'] || this.getGamepadButton(gamepad, 13),
            left: this.keys['ArrowLeft'] || this.keys['KeyA'] || this.getGamepadButton(gamepad, 14),
            right: this.keys['ArrowRight'] || this.keys['KeyD'] || this.getGamepadButton(gamepad, 15),
            action: this.keys['Space'] || this.keys['Enter'] || this.getGamepadButton(gamepad, 0),
            cancel: this.keys['Escape'] || this.getGamepadButton(gamepad, 1),
            pause: this.keys['KeyP'] || this.keys['Escape'] || this.getGamepadButton(gamepad, 9),
            keys: { ...this.keys },
        };
    }

    /** Check if a specific key is pressed */
    isKeyPressed(code: string): boolean {
        return this.keys[code] || false;
    }

    /** Clear all key states */
    clear(): void {
        this.keys = {};
    }

    private handleKeyDown(e: KeyboardEvent): void {
        // Prevent default for game keys
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
            e.preventDefault();
        }
        this.keys[e.code] = true;
    }

    private handleKeyUp(e: KeyboardEvent): void {
        this.keys[e.code] = false;
    }

    private handleGamepadConnected(e: GamepadEvent): void {
        console.log(`[InputManager] Gamepad connected: ${e.gamepad.id}`);
        this.gamepadIndex = e.gamepad.index;
    }

    private handleGamepadDisconnected(e: GamepadEvent): void {
        console.log(`[InputManager] Gamepad disconnected: ${e.gamepad.id}`);
        if (this.gamepadIndex === e.gamepad.index) {
            this.gamepadIndex = null;
        }
    }

    private getGamepad(): Gamepad | null {
        if (this.gamepadIndex === null) return null;
        const gamepads = navigator.getGamepads();
        return gamepads[this.gamepadIndex] || null;
    }

    private getGamepadButton(gamepad: Gamepad | null, index: number): boolean {
        if (!gamepad) return false;
        return gamepad.buttons[index]?.pressed || false;
    }
}
