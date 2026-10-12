import { afterEach, expect, it, vi } from "vitest";
import { FlightAudio } from "../games/stellar-flight/FlightAudio";
import { useSettingsStore } from "../stores/settingsStore";
const contexts: FakeAudioContext[] = [];
class FakeAudioContext {
  state = "running";
  currentTime = 1;
  destination = {};
  started = false;
  oscillator = {
    type: "triangle",
    frequency: { setTargetAtTime: vi.fn() },
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(() => {
      this.started = true;
    }),
    stop: vi.fn(() => {
      if (!this.started) throw new Error("Oscillator has not started");
    }),
  };
  gain = {
    gain: { value: 0, setTargetAtTime: vi.fn() },
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
  close = vi.fn(async () => {});
  resume = vi.fn(async () => {});
  constructor() {
    contexts.push(this);
  }
  createOscillator() {
    return this.oscillator;
  }
  createGain() {
    return this.gain;
  }
  createBiquadFilter() {
    return { type: "lowpass", frequency: { value: 0 }, connect: vi.fn() };
  }
}
afterEach(() => {
  vi.unstubAllGlobals();
  contexts.length = 0;
  useSettingsStore.getState().reset();
});
it("engine audio stays silent before play, honors mute, pauses, resumes, and releases resources", () => {
  vi.stubGlobal("AudioContext", FakeAudioContext);
  useSettingsStore.setState({ muted: false, volume: 0.5 });
  const audio = new FlightAudio();
  audio.pause();
  audio.update(120, false);
  expect(contexts).toHaveLength(0);
  audio.resume();
  audio.update(120, false);
  const context = contexts[0];
  expect(contexts).toHaveLength(1);
  expect(context.gain.gain.setTargetAtTime.mock.lastCall?.[0]).toBeGreaterThan(
    0,
  );
  audio.pause();
  expect(context.gain.gain.setTargetAtTime.mock.lastCall?.[0]).toBe(0);
  audio.update(300, true);
  expect(context.gain.gain.setTargetAtTime.mock.lastCall?.[0]).toBe(0);
  audio.resume();
  useSettingsStore.setState({ muted: true });
  audio.update(300, true);
  expect(context.gain.gain.setTargetAtTime.mock.lastCall?.[0]).toBe(0);
  useSettingsStore.setState({ muted: false, volume: 0.25 });
  audio.update(300, true);
  expect(context.gain.gain.setTargetAtTime.mock.lastCall?.[0]).toBeGreaterThan(
    0,
  );
  audio.destroy();
  audio.destroy();
  expect(context.oscillator.stop).toHaveBeenCalledTimes(1);
  expect(context.close).toHaveBeenCalledTimes(1);
});
it("unavailable audio effects do not interrupt flight or repeatedly allocate contexts", () => {
  class BrokenAudioContext extends FakeAudioContext {
    createBiquadFilter(): never {
      throw new Error("Audio filter unavailable");
    }
  }
  vi.stubGlobal("AudioContext", BrokenAudioContext);
  useSettingsStore.setState({ muted: false, volume: 0.5 });
  const audio = new FlightAudio();
  expect(() => audio.update(120, false)).not.toThrow();
  expect(() => audio.update(120, false)).not.toThrow();
  expect(contexts).toHaveLength(1);
  expect(contexts[0].close).toHaveBeenCalledTimes(1);
  audio.destroy();
});
