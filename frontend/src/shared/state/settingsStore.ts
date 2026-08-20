import { create } from "zustand";
import { useSyncExternalStore } from "react";
import { createJSONStorage, persist } from "zustand/middleware";
import { bindingProblem, normalizeBindings } from "../input/controls";
let storageUnavailable = false;
const storageListeners = new Set<() => void>();
function storageStatus(unavailable: boolean) {
  if (unavailable === storageUnavailable) return;
  storageUnavailable = unavailable;
  storageListeners.forEach((listener) => listener());
}
export function usePreferenceStorageUnavailable() {
  return useSyncExternalStore(
    (listener) => {
      storageListeners.add(listener);
      return () => storageListeners.delete(listener);
    },
    () => storageUnavailable,
  );
}
interface Preferences {
  volume: number;
  muted: boolean;
  reducedMotion: boolean;
  deadZone: number;
  bindings: Record<string, string>;
  setDeadZone: (value: number) => void;
  setBinding: (action: string, code: string) => string | null;
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
      setBinding: (action, code) => {
        let problem: string | null = null;
        set((state) => {
          problem = bindingProblem(action, code, state.bindings);
          return problem
            ? state
            : { bindings: { ...state.bindings, [action]: code } };
        });
        return problem;
      },
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
      storage: createJSONStorage(() => ({
        getItem: (name) => {
          try {
            return localStorage.getItem(name);
          } catch {
            storageStatus(true);
            return null;
          }
        },
        setItem: (name, value) => {
          try {
            localStorage.setItem(name, value);
            storageStatus(false);
          } catch {
            storageStatus(true);
          }
        },
        removeItem: (name) => {
          try {
            localStorage.removeItem(name);
            storageStatus(false);
          } catch {
            storageStatus(true);
          }
        },
      })),
      onRehydrateStorage: () => (_state, error) => {
        if (error) storageStatus(true);
      },
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
          bindings: normalizeBindings(value?.bindings),
        };
      },
    },
  ),
);
