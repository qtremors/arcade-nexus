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
  static getInstance(): GamepadManager {
    return (this.instance ??= new GamepadManager());
  }
  addListener(handler: Handler): void {
    this.listeners.add(handler);
    if (this.interval === null)
      this.interval = window.setInterval(this.poll, 32);
  }
  removeListener(handler: Handler): void {
    this.listeners.delete(handler);
    if (!this.listeners.size && this.interval !== null) {
      clearInterval(this.interval);
      this.interval = null;
      this.pressed.clear();
    }
  }
  private poll = (): void => {
    const pad = Array.from(navigator.getGamepads?.() ?? []).find(
      (p) => p?.connected,
    );
    if (!pad) {
      this.pressed.clear();
      this.padId = null;
      return;
    }
    const id = `${pad.index}:${pad.id}`;
    if (id !== this.padId) {
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
    for (const name of next)
      if (!this.pressed.has(name)) this.listeners.forEach((fn) => fn(name));
    this.pressed = next;
  };
}
