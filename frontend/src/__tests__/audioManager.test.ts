import { afterEach, beforeEach, expect, it, vi } from "vitest";
const contexts: FakeAudioContext[] = [];
class FakeAudioContext {
  state = "running";
  currentTime = 0;
  destination = {};
  gain = { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() };
  constructor() {
    contexts.push(this);
  }
  createGain() {
    return { gain: this.gain, connect: vi.fn(), disconnect: vi.fn() };
  }
  createOscillator() {
    return {
      type: "sine",
      frequency: this.gain,
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      onended: null,
    };
  }
  resume = vi.fn(async () => {
    this.state = "running";
  });
  suspend = vi.fn(async () => {
    this.state = "suspended";
  });
  close = vi.fn(async () => {
    this.state = "closed";
  });
}
let useSettingsStore: typeof import("../stores/settingsStore").useSettingsStore;
let audio: import("../sdk/AudioManager").AudioManager;
beforeEach(async () => {
  vi.resetModules();
  ({ useSettingsStore } = await import("../stores/settingsStore"));
  const { AudioManager } = await import("../sdk/AudioManager");
  AudioManager.configure({
    readPreferences: () => useSettingsStore.getState(),
    subscribe: (callback) => useSettingsStore.subscribe(callback),
    setVolume: (value) => useSettingsStore.getState().setVolume(value),
    setMuted: (value) => useSettingsStore.getState().setMuted(value),
  });
  audio = AudioManager.getInstance();
  contexts.length = 0;
  vi.useFakeTimers();
  vi.stubGlobal("AudioContext", FakeAudioContext);
  useSettingsStore.setState({ volume: 0.5, muted: false });
});
afterEach(async () => {
  await vi.runAllTimersAsync();
  useSettingsStore.setState({ muted: true });
  await vi.advanceTimersByTimeAsync(0);
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it("boot and game cues survive unavailable audio devices and node allocation failures", async () => {
  vi.stubGlobal(
    "AudioContext",
    class {
      constructor() {
        throw new Error("No audio device");
      }
    },
  );
  expect(() => audio.playBoot()).not.toThrow();
  vi.stubGlobal(
    "AudioContext",
    class extends FakeAudioContext {
      createOscillator(): never {
        throw new Error("Device lost");
      }
    },
  );
  expect(() => audio.playGameCue("hit")).not.toThrow();
  expect(contexts.at(-1)?.close).toHaveBeenCalledOnce();
});
it("does not allocate audio for muted or zero volume gestures and boot", () => {
  const count = contexts.length;
  useSettingsStore.setState({ volume: 0 });
  audio.unlock();
  audio.playBoot();
  useSettingsStore.setState({ volume: 0.5, muted: true });
  audio.unlock();
  audio.playBoot();
  expect(contexts).toHaveLength(count);
});
it("suspends idle system audio, resumes for cues, and immediately honors mute", async () => {
  audio.playGameCue("collect");
  const context = contexts.at(-1)!;
  await vi.advanceTimersByTimeAsync(300);
  expect(context.state).toBe("suspended");
  audio.playBoot();
  await vi.advanceTimersByTimeAsync(0);
  expect(context.state).toBe("running");
  await vi.advanceTimersByTimeAsync(500);
  audio.playHover();
  await vi.advanceTimersByTimeAsync(300);
  expect(context.state).toBe("running"); // Do not truncate the overlapping boot tone.
  useSettingsStore.getState().setMuted(true);
  await vi.advanceTimersByTimeAsync(0);
  expect(context.state).toBe("suspended");
  expect(context.gain.setValueAtTime.mock.lastCall?.[0]).toBe(0);
});
