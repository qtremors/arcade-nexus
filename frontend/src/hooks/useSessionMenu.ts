import { useEffect, useEffectEvent, type RefObject } from "react";
import { useGamepad } from "./useGamepad";
import { isEditing } from "../sdk/InputManager";
import { isFocusableControl } from "../sdk/menuNavigation";
import type { SessionPhase } from "../services/lifecycle";
export function useSessionMenu({
  state,
  isBusy,
  modal,
  pause,
  resume,
  closeSlots,
  quit,
  start,
}: {
  state: SessionPhase;
  isBusy: () => boolean;
  modal: RefObject<HTMLDivElement | null>;
  pause: () => void;
  resume: () => void;
  closeSlots: () => void;
  quit: () => Promise<void>;
  start: () => Promise<void>;
}) {
  const keyboard = useEffectEvent((event: KeyboardEvent) => {
    if (document.querySelector("dialog[open]")) return;
    if (event.repeat || isEditing(event.target) || isBusy()) return;
    if (
      (event.code === "Escape" || event.code === "KeyP") &&
      state === "playing"
    ) {
      event.preventDefault();
      pause();
      return;
    }
    if (event.code === "Escape" && state !== "playing") {
      event.preventDefault();
      if (state === "paused") resume();
      else if (state === "save" || state === "load") closeSlots();
      else void quit();
    } else if (
      event.code === "Space" &&
      state === "ready" &&
      !(event.target instanceof HTMLButtonElement)
    ) {
      event.preventDefault();
      void start();
    }
  });
  useEffect(() => {
    const handler = (e: KeyboardEvent) => keyboard(e);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  useGamepad((button) => {
    if (document.querySelector("dialog[open]")) return;
    if (state === "playing" && button === "Start") {
      pause();
      return;
    }
    if (isBusy() || state === "playing") return;
    if (button === "B") {
      if (state === "paused") resume();
      else if (state === "save" || state === "load") closeSlots();
      else void quit();
    }
    if (button === "A") (document.activeElement as HTMLElement | null)?.click();
    if (["Up", "Down", "Left", "Right"].includes(button)) {
      const targets = Array.from(
        modal.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled),summary",
        ) ?? [],
      ).filter(isFocusableControl);
      const at = targets.indexOf(document.activeElement as HTMLElement),
        shift = ["Down", "Right"].includes(button) ? 1 : -1;
      targets[(at + shift + targets.length) % targets.length]?.focus();
    }
  });
}
