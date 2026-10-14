import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { GameEngine } from "../sdk/GameEngine";
import { InputManager } from "../sdk/InputManager";
import { GamepadManager } from "../sdk/GamepadManager";
import type { Game2DInstance } from "../sdk/GameSDK";
let frames: Map<number, FrameRequestCallback>, id: number;
const tick = (time: number) => {
  const pending = [...frames.values()];
  frames.clear();
  pending.forEach((fn) => fn(time));
};
const config = { slug: "test", title: "Test", width: 960, height: 640 };
const canvas = () =>
  ({
    width: 0,
    height: 0,
    getContext: () => ({ setTransform: vi.fn() }),
  }) as unknown as HTMLCanvasElement;
const game = (): Game2DInstance => ({
  type: "2d",
  init: vi.fn(),
  update: vi.fn(() => true),
  render: vi.fn(),
  destroy: vi.fn(),
  getScore: () => 20,
});
beforeEach(() => {
  frames = new Map();
  id = 0;
  vi.spyOn(performance, "now").mockReturnValue(0);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++id, callback);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (frame: number) =>
    frames.delete(frame),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
});
it("game over stops the RAF and notifies exactly once", async () => {
  const instance = game();
  instance.update = vi.fn(() => false);
  const over = vi.fn();
  const engine = new GameEngine();
  engine.onGameOver(over);
  await engine.init(canvas(), instance, config);
  engine.start();
  tick(20);
  tick(40);
  expect(over).toHaveBeenCalledExactlyOnceWith(20);
  expect(engine.getMetrics().ended).toBe(true);
  expect(frames.size).toBe(0);
  engine.destroy();
});
it("an exception in the simulation stops the loop and reaches the UI", async () => {
  const instance = game();
  instance.update = vi.fn(() => {
    throw new Error("render failure");
  });
  const error = vi.fn();
  const engine = new GameEngine();
  engine.onError(error);
  await engine.init(canvas(), instance, config);
  engine.start();
  tick(20);
  expect(error).toHaveBeenCalledOnce();
  expect(engine.getMetrics().ended).toBe(false);
  expect(engine.running).toBe(false);
  expect(frames.size).toBe(0);
  engine.destroy();
});
it("pausing releases keyboard input and skips elapsed paused time", async () => {
  const instance = game(),
    engine = new GameEngine();
  await engine.init(canvas(), instance, config);
  engine.start();
  tick(20);
  engine.pause();
  expect(engine.getMetrics().ended).toBe(false);
  expect(frames.size).toBe(0);
  tick(1000);
  expect(instance.update).toHaveBeenCalledTimes(1);
  vi.spyOn(performance, "now").mockReturnValue(1000);
  engine.resume();
  engine.resume();
  expect(frames.size).toBe(1);
  tick(1020);
  expect(instance.update).toHaveBeenCalledTimes(2);
  engine.destroy();
});
it("a 30 Hz display retains 60 simulation steps and bounds catch-up after a stall", async () => {
  const instance = game(),
    engine = new GameEngine();
  await engine.init(canvas(), instance, config);
  engine.start();
  for (let i = 1; i <= 30; i++) tick((i * 1000) / 30);
  expect(instance.update).toHaveBeenCalledTimes(60);
  expect(instance.render).toHaveBeenCalledTimes(31);
  tick(10000);
  expect(instance.update).toHaveBeenCalledTimes(66);
  expect(instance.render).toHaveBeenCalledTimes(32);
  engine.destroy();
});
it("destroying during an async init cannot restart a disposed game", async () => {
  let done!: () => void;
  const instance = game();
  instance.init = () =>
    new Promise((resolve) => {
      done = resolve;
    });
  const engine = new GameEngine();
  const initializing = engine.init(canvas(), instance, config);
  engine.destroy();
  done();
  await initializing;
  engine.start();
  expect(engine.running).toBe(false);
  expect(frames.size).toBe(0);
});
it("keyboard blur clears held input and text entry is ignored", () => {
  const input = new InputManager();
  input.start();
  window.dispatchEvent(new KeyboardEvent("keydown", { code: "ArrowUp" }));
  expect(input.getState().up).toBe(true);
  window.dispatchEvent(new Event("blur"));
  expect(input.getState().up).toBe(false);
  const field = document.createElement("input");
  document.body.append(field);
  field.dispatchEvent(
    new KeyboardEvent("keydown", { code: "Space", bubbles: true }),
  );
  expect(input.getState().action).toBe(false);
  field.remove();
  input.stop();
});
it("already-connected controllers work at nonzero indices and stick reversal resets", () => {
  vi.useFakeTimers();
  const pad = {
    connected: true,
    index: 2,
    id: "Test",
    axes: [-1, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false })),
  };
  vi.stubGlobal("navigator", { getGamepads: () => [null, null, pad] });
  const input = new InputManager();
  expect(input.getState().left).toBe(true);
  const manager = GamepadManager.getInstance(),
    listener = vi.fn();
  manager.addListener(listener);
  vi.advanceTimersByTime(32);
  pad.axes[0] = 1;
  vi.advanceTimersByTime(32);
  pad.axes[0] = -1;
  vi.advanceTimersByTime(32);
  expect(listener.mock.calls.map((call) => call[0])).toEqual([
    "Left",
    "Right",
    "Left",
  ]);
  pad.buttons[9].pressed = true;
  vi.advanceTimersByTime(32);
  expect(listener).toHaveBeenCalledWith("Start");
  manager.removeListener(listener);
  expect(vi.getTimerCount()).toBe(0);
  vi.useRealTimers();
});
it("quick keyboard taps remain buffered until a simulation step consumes them", () => {
  const input = new InputManager();
  input.start();
  window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" }));
  window.dispatchEvent(new KeyboardEvent("keyup", { code: "Space" }));
  expect(input.getState().action).toBe(true);
  input.consumePresses();
  expect(input.getState().action).toBe(false);
  input.stop();
});
it("controller confirm used to launch the game waits for release before becoming a game action", () => {
  const pad = {
    connected: true,
    index: 1,
    axes: [0, 0],
    buttons: Array.from({ length: 17 }, (_, id) => ({ pressed: id === 0 })),
  };
  vi.stubGlobal("navigator", { getGamepads: () => [null, pad] });
  const input = new InputManager();
  input.start();
  expect(input.getState().action).toBe(false);
  pad.buttons[0].pressed = false;
  input.getState();
  pad.buttons[0].pressed = true;
  expect(input.getState().action).toBe(true);
  input.stop();
});
it("a released tap is consumed once across catch-up simulation steps", async () => {
  const instance = game(),
    engine = new GameEngine();
  const actions: boolean[] = [];
  instance.update = (_dt, input) => {
    actions.push(input.action);
    return true;
  };
  await engine.init(canvas(), instance, config);
  engine.start();
  window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" }));
  window.dispatchEvent(new KeyboardEvent("keyup", { code: "Space" }));
  tick(70);
  expect(actions.length).toBeGreaterThan(1);
  expect(actions.filter(Boolean)).toHaveLength(1);
  engine.destroy();
});
it("recoverable game over resumes the same engine after undo", async () => {
  const instance = game(),
    engine = new GameEngine();
  let terminal = true;
  instance.update = () => !terminal;
  instance.getStatus = () => (terminal ? "recoverable" : "playing");
  instance.recover = () => {
    terminal = false;
  };
  await engine.init(canvas(), instance, config);
  engine.start();
  tick(20);
  expect(engine.recoverable).toBe(true);
  expect(engine.getMetrics().ended).toBe(true);
  engine.recover();
  expect(engine.getMetrics().ended).toBe(false);
  tick(40);
  expect(engine.running).toBe(true);
  engine.destroy();
});
