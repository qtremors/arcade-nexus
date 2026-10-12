/** Spatial focus follows the visible layout and scrolls the selected control into view. */
export function moveMenuFocus(
  direction: "Up" | "Down" | "Left" | "Right",
  root?: ParentNode,
): void {
  const controls = Array.from(
    (root ?? document).querySelectorAll<HTMLElement>(
      root
        ? "button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled)"
        : "header a, header button, main button:not(:disabled), main a[href], main input:not(:disabled), main select:not(:disabled)",
    ),
  ).filter(
    (element) =>
      !element.closest("[inert]") && element.getBoundingClientRect().width > 0,
  );
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
