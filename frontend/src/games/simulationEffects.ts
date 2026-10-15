/** Browser effects are optional ports; durable simulations run without a DOM. */
export interface SimulationEffects {
  reducedMotion(): boolean;
  update(dt: number): void;
  sound(cue: "hit" | "collect" | "jump" | "miss"): void;
  burst(x: number, y: number, color: string, label?: string): void;
  clear(): void;
}
export const silentEffects: SimulationEffects = {
  reducedMotion: () => false,
  update: () => {},
  sound: () => {},
  burst: () => {},
  clear: () => {},
};
/** A live rendering projection: no serialization or copying on each frame. */
export type RenderView<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends object
    ? { readonly [K in keyof T]: RenderView<T[K]> }
    : T;
