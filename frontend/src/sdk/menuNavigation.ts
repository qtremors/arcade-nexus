/** Shared visibility rules for keyboard traps and spatial controller navigation. */
export function isFocusableControl(target: HTMLElement): boolean {
  if (
    target.matches(':disabled,input[type="hidden"]') ||
    (target.hasAttribute("tabindex") && target.tabIndex < 0) ||
    target.closest('[hidden],[inert],[aria-hidden="true"]') ||
    target.getClientRects().length === 0 ||
    ["hidden", "collapse"].includes(getComputedStyle(target).visibility)
  )
    return false;
  let closed = target.parentElement?.closest("details:not([open])");
  while (closed) {
    const summary = Array.from(closed.children).find(
      (child) => child.tagName === "SUMMARY",
    );
    if (!summary?.contains(target)) return false;
    closed = closed.parentElement?.closest("details:not([open])");
  }
  return true;
}
/** Spatial focus follows the visible layout and scrolls the selected control into view. */
export function moveMenuFocus(
  direction: "Up" | "Down" | "Left" | "Right",
  root?: ParentNode,
): void {
  const controls = Array.from(
    (root ?? document).querySelectorAll<HTMLElement>(
      root
        ? "button, a[href], input, select, summary"
        : "header a, header button, main button, main a[href], main input, main select, main summary",
    ),
  ).filter(isFocusableControl);
  const current = document.activeElement as HTMLElement | null;
  let target = controls[0];
  if (current && controls.includes(current)) {
    const origin = current.getBoundingClientRect(),
      ox = origin.x + origin.width / 2,
      oy = origin.y + origin.height / 2;
    const horizontal = direction === "Left" || direction === "Right",
      sign = direction === "Left" || direction === "Up" ? -1 : 1;
    target = controls
      .filter((element) => element !== current)
      .map((element) => {
        const rect = element.getBoundingClientRect(),
          dx = rect.x + rect.width / 2 - ox,
          dy = rect.y + rect.height / 2 - oy;
        const crossGap = horizontal
          ? Math.max(0, origin.top - rect.bottom, rect.top - origin.bottom)
          : Math.max(0, origin.left - rect.right, rect.left - origin.right);
        return {
          element,
          advance: (horizontal ? dx : dy) * sign,
          score: Math.hypot(horizontal ? dx : dy, crossGap * 2),
        };
      })
      .filter((candidate) => candidate.advance > 4)
      .sort((a, b) => a.score - b.score)[0]?.element;
  }
  target?.focus({ preventScroll: true });
  target?.scrollIntoView({ block: "nearest", inline: "nearest" });
}

export function activateControl(): void {
  const focused = document.activeElement;
  if (
    focused instanceof HTMLInputElement &&
    ["text", "search"].includes(focused.type)
  ) {
    window.dispatchEvent(
      new CustomEvent("nexus-keyboard", { detail: focused }),
    );
  } else (focused as HTMLElement | null)?.click();
}
