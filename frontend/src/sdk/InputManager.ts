import type { InputState } from "./GameSDK";
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
    this.presses.add(event.code);
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
    const x = gamepad?.axes[0] ?? 0,
      y = gamepad?.axes[1] ?? 0;
    return {
      up: !!(keys.ArrowUp || keys.KeyW || button(12) || y < -0.5),
      down: !!(keys.ArrowDown || keys.KeyS || button(13) || y > 0.5),
      left: !!(keys.ArrowLeft || keys.KeyA || button(14) || x < -0.5),
      right: !!(keys.ArrowRight || keys.KeyD || button(15) || x > 0.5),
      action: !!(keys.Space || keys.Enter || button(0)),
      cancel: !!(keys.Escape || button(1)),
      pause: !!(keys.KeyP || keys.Escape || button(9)),
      keys: {
        ...keys,
        ShiftLeft: !!(keys.ShiftLeft || button(7)),
        ControlLeft: !!(keys.ControlLeft || button(6)),
        KeyQ: !!(keys.KeyQ || button(4)),
        KeyE: !!(keys.KeyE || button(5)),
      },
    };
  }
}
