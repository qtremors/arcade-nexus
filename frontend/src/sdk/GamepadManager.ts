export type GamepadButton =
  | "A"
  | "B"
  | "X"
  | "Y"
  | "LB"
  | "RB"
  | "LT"
  | "RT"
  | "Back"
  | "Start"
  | "LStick"
  | "RStick"
  | "Up"
  | "Down"
  | "Left"
  | "Right"
  | "Guide";
type Handler = (button: GamepadButton) => void;
const buttons: GamepadButton[] = [
  "A",
  "B",
  "X",
  "Y",
  "LB",
  "RB",
  "LT",
  "RT",
  "Back",
  "Start",
  "LStick",
  "RStick",
  "Up",
  "Down",
  "Left",
  "Right",
  "Guide",
];
export class GamepadManager {
  private static instance: GamepadManager;
  private listeners = new Set<Handler>();
  private interval: number | null = null;
  private pressed = new Set<GamepadButton>();
  private padId: string | null = null;
  private suppressHeld = false;
  static getInstance(): GamepadManager {
    return (this.instance ??= new GamepadManager());
  }
  addListener(handler: Handler): void {
    const first = !this.listeners.size;
    this.listeners.add(handler);
    if (first) {
      window.addEventListener("gamepadconnected", this.refresh);
      window.addEventListener("gamepaddisconnected", this.refresh);
      document.addEventListener("visibilitychange", this.visibility);
      this.refresh();
    }
  }
  removeListener(handler: Handler): void {
    this.listeners.delete(handler);
    if (!this.listeners.size) {
      this.stopPolling();
      this.pressed.clear();
      this.padId = null;
      window.removeEventListener("gamepadconnected", this.refresh);
      window.removeEventListener("gamepaddisconnected", this.refresh);
      document.removeEventListener("visibilitychange", this.visibility);
    }
  }
  private stopPolling(): void {
    if (this.interval !== null) clearInterval(this.interval);
    this.interval = null;
  }
  private visibility = (): void => {
    if (document.visibilityState === "hidden") {
      this.stopPolling();
      this.suppressHeld = true;
    } else this.refresh();
  };
  private refresh = (): void => {
    if (document.visibilityState === "hidden" || !this.listeners.size) return;
    this.poll();
    if (this.padId && this.interval === null)
      this.interval = window.setInterval(this.poll, 32);
  };
  private poll = (): void => {
    const pad = Array.from(navigator.getGamepads?.() ?? []).find(
      (p) => p?.connected,
    );
    if (!pad) {
      if (this.padId)
        window.dispatchEvent(new Event("nexus-controller-disconnected"));
      this.pressed.clear();
      this.padId = null;
      this.stopPolling();
      return;
    }
    const id = `${pad.index}:${pad.id}`;
    if (id !== this.padId) {
      if (this.padId) {
        this.suppressHeld = true;
        window.dispatchEvent(new Event("nexus-controller-disconnected"));
      }
      this.pressed.clear();
      this.padId = id;
    }
    const next = new Set<GamepadButton>();
    buttons.forEach((name, i) => {
      if (pad.buttons[i]?.pressed) next.add(name);
    });
    if (pad.axes[0] < -0.5) next.add("Left");
    if (pad.axes[0] > 0.5) next.add("Right");
    if (pad.axes[1] < -0.5) next.add("Up");
    if (pad.axes[1] > 0.5) next.add("Down");
    if (!this.suppressHeld)
      for (const name of next)
        if (!this.pressed.has(name)) this.listeners.forEach((fn) => fn(name));
    this.suppressHeld = false;
    this.pressed = next;
  };
}
