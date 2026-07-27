import type { InputState, GameRenderInfo } from "./GameSDK";

export interface InputPort {
  start(): void;
  stop(): void;
  getState(): InputState;
  consumePresses(): void;
}
export interface InputPreferences {
  deadZone: number;
  bindings: Record<string, string>;
}
export interface EnginePorts {
  input?: InputPort;
  validateState?: (state: Record<string, unknown>) => Record<string, unknown>;
  reportMeasurement?: (
    slug: string,
    launchMs: number,
    samples: number[],
    info: GameRenderInfo,
  ) => void;
}
export interface EffectPort {
  reducedMotion(): boolean;
  sound(cue: "hit" | "collect" | "jump" | "miss"): void;
}
export interface AudioPort {
  readPreferences(): { muted: boolean; volume: number };
  subscribe(callback: () => void): () => void;
  setVolume(value: number): void;
  setMuted(value: boolean): void;
}
let effects: EffectPort = { reducedMotion: () => false, sound: () => {} };
export const gameEffects: EffectPort = {
  reducedMotion: () => effects.reducedMotion(),
  sound: (cue) => effects.sound(cue),
};
export function configureGameEffects(port: EffectPort) {
  effects = port;
}
