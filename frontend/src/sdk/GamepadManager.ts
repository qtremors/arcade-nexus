export type GamepadButton = 'A' | 'B' | 'X' | 'Y' | 'LB' | 'RB' | 'LT' | 'RT' | 'Back' | 'Start' | 'LStick' | 'RStick' | 'Up' | 'Down' | 'Left' | 'Right' | 'Guide';

type GamepadEventHandler = (button: GamepadButton) => void;

/**
 * GamepadManager
 * Singleton class to handle gamepad input efficiently.
 * Only polls when a gamepad is connected.
 */
export class GamepadManager {
    private static instance: GamepadManager;
    private listeners: Set<GamepadEventHandler> = new Set();
    private pollingInterval: number | null = null;

    // State to debounce inputs (prevent rapid firing)
    private buttonState: Record<number, boolean> = {};
    // Thresholds
    private readonly AXIS_THRESHOLD = 0.5;

    private constructor() {
        window.addEventListener('gamepadconnected', this.handleConnect);
        window.addEventListener('gamepaddisconnected', this.handleDisconnect);
    }

    public static getInstance(): GamepadManager {
        if (!GamepadManager.instance) {
            GamepadManager.instance = new GamepadManager();
        }
        return GamepadManager.instance;
    }

    public addListener(handler: GamepadEventHandler) {
        this.listeners.add(handler);
    }

    public removeListener(handler: GamepadEventHandler) {
        this.listeners.delete(handler);
    }

    private handleConnect = () => {
        console.log("Gamepad connected");
        this.startPolling();
    };

    private handleDisconnect = () => {
        console.log("Gamepad disconnected");
        // Don't stop polling immediately in case of flaky connection, or check if other gamepads exist
        if (navigator.getGamepads().filter(g => g !== null).length === 0) {
            this.stopPolling();
        }
    };

    private startPolling() {
        if (this.pollingInterval) return;
        // Poll at 60fps equivalent (approx 16ms)
        this.pollingInterval = window.setInterval(this.poll, 16);
    }

    private stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    }

    private poll = () => {
        const gamepads = navigator.getGamepads();
        if (!gamepads[0]) return; // Focus on player 1 for now

        const gp = gamepads[0];

        // Standard Mapping (Xbox/DualSense)
        // 0: A, 1: B, 2: X, 3: Y
        // 12: Up, 13: Down, 14: Left, 15: Right

        this.checkButton(gp, 0, 'A');
        this.checkButton(gp, 1, 'B');
        this.checkButton(gp, 12, 'Up');
        this.checkButton(gp, 13, 'Down');
        this.checkButton(gp, 14, 'Left');
        this.checkButton(gp, 15, 'Right');

        // Axis handling (optional, map to D-pad events for menu nav)
        // Axis 0: Left Stick X (-1 Left, 1 Right)
        // Axis 1: Left Stick Y (-1 Up, 1 Down)
        this.checkAxisAsButton(gp, 0, -1, 'Left');
        this.checkAxisAsButton(gp, 0, 1, 'Right');
        this.checkAxisAsButton(gp, 1, -1, 'Up');
        this.checkAxisAsButton(gp, 1, 1, 'Down');
    };

    private checkButton(gp: Gamepad, index: number, buttonParams: GamepadButton) {
        const pressed = gp.buttons[index]?.pressed;

        if (pressed && !this.buttonState[index]) {
            // Button Down
            this.buttonState[index] = true;
            this.emit(buttonParams);
        } else if (!pressed && this.buttonState[index]) {
            // Button Up
            this.buttonState[index] = false;
        }
    }

    private checkAxisAsButton(gp: Gamepad, axisIndex: number, direction: 1 | -1, buttonParams: GamepadButton) {
        // Virtual button index for axes to track state (100+)
        const virtIndex = 100 + (axisIndex * 2) + (direction === 1 ? 1 : 0);
        const val = gp.axes[axisIndex];

        // Check threshold
        const pressed = (direction === 1 ? val > this.AXIS_THRESHOLD : val < -this.AXIS_THRESHOLD);

        if (pressed && !this.buttonState[virtIndex]) {
            this.buttonState[virtIndex] = true;
            this.emit(buttonParams);
        } else if (!pressed && this.buttonState[virtIndex]) {
            if (Math.abs(val) < 0.2) { // Hysteresis reset
                this.buttonState[virtIndex] = false;
            }
        }
    }

    private emit(btn: GamepadButton) {
        this.listeners.forEach(l => l(btn));
    }
}
