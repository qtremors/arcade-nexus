import { useEffect } from 'react';
import { GamepadManager } from '../sdk/GamepadManager';
import type { GamepadButton } from '../sdk/GamepadManager';

export function useGamepad(callback: (button: GamepadButton) => void, deps: any[] = []) {
    useEffect(() => {
        const manager = GamepadManager.getInstance();
        manager.addListener(callback);

        return () => {
            manager.removeListener(callback);
        };
    }, deps);
}
