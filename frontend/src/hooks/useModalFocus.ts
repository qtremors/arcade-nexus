import { useEffect } from "react";
import type { RefObject } from "react";
import { isFocusableControl } from "../sdk/menuNavigation";
const modalStack: HTMLElement[] = [];
export function useModalFocus(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  scope: string = "",
) {
  useEffect(() => {
    if (!active || !ref.current) return;
    const previous = document.activeElement as HTMLElement | null;
    const element = ref.current;
    const nested = modalStack.findIndex((modal) => element.contains(modal));
    if (nested < 0) modalStack.push(element);
    else modalStack.splice(nested, 0, element);
    const hadTabIndex = element.hasAttribute("tabindex");
    if (!hadTabIndex) element.tabIndex = -1;
    const targets = () =>
      Array.from(
        element.querySelectorAll<HTMLElement>(
          "button,input,select,textarea,summary,a[href],[tabindex]",
        ),
      ).filter(isFocusableControl);
    const initial = targets();
    if (modalStack.at(-1) === element)
      (
        initial.find((target) => target.dataset.primary === "true") ??
        initial[0] ??
        element
      ).focus();
    const trap = (event: KeyboardEvent) => {
      if (
        event.key !== "Tab" ||
        event.defaultPrevented ||
        modalStack.at(-1) !== element
      )
        return;
      const native = document.querySelector("dialog[open]");
      if (native && !element.contains(native)) return;
      const list = targets();
      if (!list.length) {
        event.preventDefault();
        element.focus();
        return;
      }
      const index = list.indexOf(document.activeElement as HTMLElement);
      event.preventDefault();
      const next =
        index < 0
          ? event.shiftKey
            ? list.length - 1
            : 0
          : (index + (event.shiftKey ? -1 : 1) + list.length) % list.length;
      list[next]?.focus();
    };
    document.addEventListener("keydown", trap);
    return () => {
      document.removeEventListener("keydown", trap);
      const wasTop = modalStack.at(-1) === element;
      modalStack.splice(modalStack.lastIndexOf(element), 1);
      if (!hadTabIndex) element.removeAttribute("tabindex");
      if (wasTop && previous?.isConnected && !previous.closest("[inert]"))
        previous.focus();
    };
  }, [ref, active, scope]);
}
