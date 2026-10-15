import { GameEngine } from "../sdk/GameEngine";
import { InputManager } from "../sdk/InputManager";
import { AudioManager } from "../sdk/AudioManager";
import { configureGameEffects } from "../sdk/RuntimePorts";
import { useSettingsStore } from "../stores/settingsStore";
import { recordMeasurement } from "./performance";

export function configureGameRuntime() {
  AudioManager.configure({
    readPreferences: () => useSettingsStore.getState(),
    subscribe: (callback) => useSettingsStore.subscribe(callback),
    setVolume: (value) => useSettingsStore.getState().setVolume(value),
    setMuted: (value) => useSettingsStore.getState().setMuted(value),
  });
  configureGameEffects({
    reducedMotion: () => useSettingsStore.getState().reducedMotion,
    sound: (cue) => AudioManager.getInstance().playGameCue(cue),
  });
}
export function createGameEngine(
  validateState?: (state: Record<string, unknown>) => Record<string, unknown>,
) {
  return new GameEngine({
    validateState,
    input: new InputManager(() => useSettingsStore.getState()),
    reportMeasurement: recordMeasurement,
  });
}
