import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GamepadManager } from "../../../sdk/GamepadManager";
let visible = "visible";
let connected = false;
let buttons: { pressed: boolean; value: number }[];
let manager: GamepadManager;
const listener = vi.fn();
beforeEach(() => {
  vi.useFakeTimers();
  visible = "visible";
  connected = false;
  buttons = Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }));
  vi.spyOn(document, "visibilityState", "get").mockImplementation(
    () => visible as DocumentVisibilityState,
  );
  vi.stubGlobal("navigator", {
    getGamepads: () =>
      connected
        ? [{ connected: true, id: "Test", index: 0, axes: [0, 0], buttons }]
        : [],
  });
  manager = new GamepadManager();
  listener.mockClear();
  manager.addListener(listener);
});
afterEach(() => {
  manager.removeListener(listener);
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it("sleeps without a controller and wakes on a connection event", () => {
  expect(vi.getTimerCount()).toBe(0);
  connected = true;
  window.dispatchEvent(new Event("gamepadconnected"));
  expect(vi.getTimerCount()).toBe(1);
  buttons[0].pressed = true;
  vi.advanceTimersByTime(32);
  expect(listener).toHaveBeenCalledWith("A");
});
it("sleeps when hidden and suppresses buttons held while returning to the console", () => {
  connected = true;
  window.dispatchEvent(new Event("gamepadconnected"));
  visible = "hidden";
  document.dispatchEvent(new Event("visibilitychange"));
  expect(vi.getTimerCount()).toBe(0);
  buttons[0].pressed = true;
  visible = "visible";
  document.dispatchEvent(new Event("visibilitychange"));
  expect(listener).not.toHaveBeenCalled();
  buttons[0].pressed = false;
  vi.advanceTimersByTime(32);
  buttons[0].pressed = true;
  vi.advanceTimersByTime(32);
  expect(listener).toHaveBeenCalledTimes(1);
});
it("announces disconnect once, stops polling, and supports reconnection", () => {
  const disconnected = vi.fn();
  window.addEventListener("nexus-controller-disconnected", disconnected);
  try {
    connected = true;
    window.dispatchEvent(new Event("gamepadconnected"));
    connected = false;
    vi.advanceTimersByTime(32);
    expect(disconnected).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    connected = true;
    window.dispatchEvent(new Event("gamepadconnected"));
    expect(vi.getTimerCount()).toBe(1);
    manager.removeListener(listener);
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    window.removeEventListener("nexus-controller-disconnected", disconnected);
  }
});

it("pauses on a primary controller handover and waits for held buttons to be released", () => {
  const disconnected = vi.fn();
  window.addEventListener("nexus-controller-disconnected", disconnected);
  try {
    const replacement = {
      connected: true,
      id: "Second",
      index: 1,
      axes: [0, 0],
      buttons,
    };
    let firstConnected = true;
    vi.stubGlobal("navigator", {
      getGamepads: () =>
        firstConnected
          ? [
              { connected: true, id: "First", index: 0, axes: [0, 0], buttons },
              replacement,
            ]
          : [null, replacement],
    });
    window.dispatchEvent(new Event("gamepadconnected"));
    buttons[0].pressed = true;
    buttons[9].pressed = true;
    firstConnected = false;
    vi.advanceTimersByTime(64);
    expect(disconnected).toHaveBeenCalledTimes(1);
    expect(listener).not.toHaveBeenCalled();
    buttons[0].pressed = false;
    buttons[9].pressed = false;
    vi.advanceTimersByTime(32);
    buttons[0].pressed = true;
    vi.advanceTimersByTime(32);
    expect(listener).toHaveBeenCalledExactlyOnceWith("A");
  } finally {
    window.removeEventListener("nexus-controller-disconnected", disconnected);
  }
});
