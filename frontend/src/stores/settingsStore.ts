import { create } from "zustand";
import { persist } from "zustand/middleware";
interface Preferences {
  volume: number;
  muted: boolean;
  reducedMotion: boolean;
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
      reducedMotion: false,
      setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)) }),
      setMuted: (muted) => set({ muted }),
      setReducedMotion: (reducedMotion) => set({ reducedMotion }),
      reset: () => set({ volume: 0.5, muted: false, reducedMotion: false }),
    }),
    {
      name: "nexus-preferences",
      partialize: ({ volume, muted, reducedMotion }) => ({
        volume,
        muted,
        reducedMotion,
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
          reducedMotion: value?.reducedMotion === true,
        };
      },
    },
  ),
);
