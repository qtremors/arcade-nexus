/** Legal console transitions, separate from asynchronous effects and game rules. */
export type SessionPhase =
  | "loading"
  | "ready"
  | "playing"
  | "paused"
  | "gameover"
  | "save"
  | "load"
  | "error";
const transitions: Record<SessionPhase, SessionPhase[]> = {
  loading: ["ready", "paused", "error"],
  ready: ["playing", "paused", "load", "loading", "error"],
  playing: ["paused", "gameover", "error"],
  paused: ["playing", "save", "load", "loading", "error"],
  gameover: ["playing", "paused", "loading", "error"],
  save: ["paused", "ready", "gameover", "load", "error"],
  load: ["paused", "ready", "gameover", "save", "error"],
  error: ["loading", "ready", "paused"],
};
export function transition(
  state: SessionPhase,
  next: SessionPhase,
): SessionPhase {
  if (state === next || transitions[state].includes(next)) return next;
  throw new Error(`Unsupported game transition: ${state} → ${next}`);
}
