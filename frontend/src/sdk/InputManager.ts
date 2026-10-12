import type { InputState } from "./GameSDK";
import { useSettingsStore } from "../stores/settingsStore";
export function isEditing(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}
export class InputManager {
  private keys: Record<string, boolean> = {};
  private presses = new Set<string>();
  private blockedButtons = new Set<string>();
  start(): void {
    // Confirm/pause used in the console must be released before gameplay sees it.
    for (const pad of navigator.getGamepads?.() ?? []) {
      if (!pad?.connected) continue;
      for (const id of [0, 1, 9])
        if (pad.buttons[id]?.pressed)
          this.blockedButtons.add(`${pad.index}:${id}`);
    }
    window.addEventListener("keydown", this.down);
    window.addEventListener("keyup", this.up);
    window.addEventListener("blur", this.clear);
  }
  stop(): void {
    window.removeEventListener("keydown", this.down);
    window.removeEventListener("keyup", this.up);
    window.removeEventListener("blur", this.clear);
    this.clear();
  }
  clear = (): void => {
    this.keys = {};
    this.presses.clear();
    this.blockedButtons.clear();
  };
  isKeyPressed(code: string): boolean {
    return !!this.keys[code];
  }
  private down = (event: KeyboardEvent): void => {
    if (isEditing(event.target) || event.defaultPrevented) return;
    if (
      ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(
        event.code,
      )
    )
      event.preventDefault();
    this.keys[event.code] = true;
    if (!event.repeat) this.presses.add(event.code);
  };
  private up = (event: KeyboardEvent): void => {
    this.keys[event.code] = false;
  };
  consumePresses(): void {
    this.presses.clear();
  }
  getState(): InputState {
    const keys = {
      ...this.keys,
      ...Object.fromEntries([...this.presses].map((code) => [code, true])),
    };
    const gamepad = Array.from(navigator.getGamepads?.() ?? []).find(
      (g) => g?.connected,
    );
    const button = (id: number) => {
      const key = `${gamepad?.index}:${id}`,
        pressed = !!gamepad?.buttons[id]?.pressed;
      if (!pressed) this.blockedButtons.delete(key);
      return pressed && !this.blockedButtons.has(key);
    };
    const { deadZone, bindings } = useSettingsStore.getState();
    const axis = (value: number) =>
      Math.abs(value) <= deadZone
        ? 0
        : (Math.sign(value) * (Math.abs(value) - deadZone)) / (1 - deadZone);
    const x = axis(gamepad?.axes[0] ?? 0),
      y = axis(gamepad?.axes[1] ?? 0);
    const key = (action: string, defaults: string[]) =>
      bindings[action]
        ? keys[bindings[action]]
        : defaults.some((code) => keys[code]);
    return {
      up: !!(key("up", ["ArrowUp", "KeyW"]) || button(12) || y < -0.5),
      down: !!(key("down", ["ArrowDown", "KeyS"]) || button(13) || y > 0.5),
      left: !!(key("left", ["ArrowLeft", "KeyA"]) || button(14) || x < -0.5),
      right: !!(key("right", ["ArrowRight", "KeyD"]) || button(15) || x > 0.5),
      action: !!(key("action", ["Space", "Enter"]) || button(0)),
      axes: { x, y },
      pressed: [...this.presses],
      throttle:
        (gamepad?.buttons[7]?.value ?? 0) - (gamepad?.buttons[6]?.value ?? 0),
      cancel: !!(keys.Escape || button(1)),
      pause: !!(keys.KeyP || keys.Escape || button(9)),
      keys: {
        ...keys,
        ShiftLeft: !!(keys.ShiftLeft || button(7)),
        ControlLeft: !!(keys.ControlLeft || button(6)),
        KeyQ: !!(keys.KeyQ || button(4)),
        KeyE: !!(keys.KeyE || button(5)),
        KeyM: !!(keys.KeyM || button(3)),
      },
    };
  }
}
