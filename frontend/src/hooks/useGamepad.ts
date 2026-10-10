import { useEffect, useEffectEvent } from "react";
import { GamepadManager } from "../sdk/GamepadManager";
import type { GamepadButton } from "../sdk/GamepadManager";
export function useGamepad(callback: (button: GamepadButton) => void) {
  const onButton = useEffectEvent(callback);
  useEffect(() => {
    const manager = GamepadManager.getInstance();
    const listener = (button: GamepadButton) => onButton(button);
    manager.addListener(listener);
    return () => manager.removeListener(listener);
  }, []);
}
