export const actions = ["up", "down", "left", "right", "action"] as const;
export const defaultBindings: Record<string, string[]> = {
  up: ["ArrowUp", "KeyW"],
  down: ["ArrowDown", "KeyS"],
  left: ["ArrowLeft", "KeyA"],
  right: ["ArrowRight", "KeyD"],
  action: ["Space", "Enter"],
};
const validCode = (value: unknown): value is string =>
  typeof value === "string" &&
  /^(Key[A-Z]|Arrow(Up|Down|Left|Right)|Space|Enter)$/.test(value);
const reserved: Record<string, string> = {
  KeyP: "Pause",
  KeyZ: "Undo",
  KeyC: "Hold / Flight camera",
  KeyV: "Hold / ship selection",
  KeyH: "Flight contracts",
  KeyN: "Flight navigation",
  KeyM: "Flight routes",
  KeyQ: "Flight yaw",
  KeyE: "Flight yaw",
};
export function bindingProblem(
  action: string,
  code: string,
  bindings: Record<string, string>,
): string | null {
  if (!actions.includes(action as (typeof actions)[number]) || !validCode(code))
    return "Choose a letter, arrow key, Space or Enter.";
  if (reserved[code])
    return `${code.replace("Key", "")} is reserved for ${reserved[code]}. Choose a different key.`;
  const conflict = actions.find(
    (other) =>
      other !== action &&
      (bindings[other] ? [bindings[other]] : defaultBindings[other]).includes(
        code,
      ),
  );
  return conflict
    ? `${code.replace("Key", "")} is already used by ${conflict === "action" ? "the primary action" : conflict}. Change that binding first or choose another key.`
    : null;
}
export function normalizeBindings(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  const result = Object.fromEntries(
    Object.entries(value).filter(
      ([action, code]) =>
        actions.includes(action as (typeof actions)[number]) &&
        validCode(code) &&
        !reserved[code],
    ),
  );
  // Drop conflicting custom bindings together, preserving valid swaps and defaults.
  for (let pass = 0; pass < actions.length; pass++) {
    const conflicting = Object.entries(result).filter(([action, code]) =>
      bindingProblem(action, code, result),
    );
    if (!conflicting.length) break;
    for (const [action] of conflicting) delete result[action];
  }
  return result;
}
