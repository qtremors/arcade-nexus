import { create } from "zustand";
import { persist } from "zustand/middleware";
interface Preferences {
  volume: number;
  muted: boolean;
  reducedMotion: boolean;
  deadZone: number;
  bindings: Record<string, string>;
  setDeadZone: (value: number) => void;
  setBinding: (action: string, code: string) => void;
  setVolume: (volume: number) => void;
  setMuted: (muted: boolean) => void;
  setReducedMotion: (value: boolean) => void;
  reset: () => void;
}
export const useSettingsStore = create<Preferences>()(
  persist(
    (set) => ({
      volume: 0.5,
      muted: false,
      reducedMotion:
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ??
        false,
      deadZone: 0.18,
      bindings: {},
      setDeadZone: (value) =>
        set({ deadZone: Math.max(0.05, Math.min(0.5, value)) }),
      setBinding: (action, code) =>
        set((s) => ({ bindings: { ...s.bindings, [action]: code } })),
      setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)) }),
      setMuted: (muted) => set({ muted }),
      setReducedMotion: (reducedMotion) => set({ reducedMotion }),
      reset: () =>
        set({
          volume: 0.5,
          muted: false,
          reducedMotion:
            window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ??
            false,
          deadZone: 0.18,
          bindings: {},
        }),
    }),
    {
      name: "nexus-preferences",
      partialize: ({ volume, muted, reducedMotion, deadZone, bindings }) => ({
        volume,
        muted,
        reducedMotion,
        deadZone,
        bindings,
      }),
      merge: (saved, current) => {
        const value = saved as Partial<Preferences> | null;
        return {
          ...current,
          volume:
            typeof value?.volume === "number" && Number.isFinite(value.volume)
              ? Math.max(0, Math.min(1, value.volume))
              : 0.5,
          muted: value?.muted === true,
          reducedMotion:
            typeof value?.reducedMotion === "boolean"
              ? value.reducedMotion
              : current.reducedMotion,
          deadZone:
            typeof value?.deadZone === "number" &&
            Number.isFinite(value.deadZone)
              ? Math.max(0.05, Math.min(0.5, value.deadZone))
              : 0.18,
          bindings:
            value?.bindings && typeof value.bindings === "object"
              ? Object.fromEntries(
                  Object.entries(value.bindings).filter(
                    ([action, code]) =>
                      ["up", "down", "left", "right", "action"].includes(
                        action,
                      ) &&
                      typeof code === "string" &&
                      /^(Key[A-Z]|Arrow(Up|Down|Left|Right)|Space|Enter)$/.test(
                        code,
                      ),
                  ),
                )
              : {},
        };
      },
    },
  ),
);
