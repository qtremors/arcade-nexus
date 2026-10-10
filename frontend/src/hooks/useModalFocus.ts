import { useEffect } from "react";
import type { RefObject } from "react";
export function useModalFocus(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  scope: string = "",
) {
  useEffect(() => {
    if (!active || !ref.current) return;
    const previous = document.activeElement as HTMLElement | null;
    const element = ref.current;
    const targets = () =>
      Array.from(
        element.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input,select,textarea,summary,a[href],[tabindex="0"]',
        ),
      );
    (
      element.querySelector<HTMLElement>(
        '[data-primary="true"]:not(:disabled)',
      ) ?? targets()[0]
    )?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const list = targets();
      if (!list.length) return;
      const index = list.indexOf(document.activeElement as HTMLElement);
      event.preventDefault();
      list[
        (index + (event.shiftKey ? -1 : 1) + list.length) % list.length
      ]?.focus();
    };
    element.addEventListener("keydown", trap);
    return () => {
      element.removeEventListener("keydown", trap);
      if (previous?.isConnected) previous.focus();
    };
  }, [ref, active, scope]);
}
