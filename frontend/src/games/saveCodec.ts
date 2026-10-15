import type { SaveEnvelope } from "../contracts/saves";
import { getGameDefinition } from "./catalog";

/** Pure compatibility checks run before any active engine is replaced. */
export function createCodec(
  slug: string,
  parseState: (state: Record<string, unknown>) => Record<string, unknown>,
  migrate: (save: SaveEnvelope) => SaveEnvelope = (save) => save,
  validateConfig: (config: Record<string, unknown>) => void = () => {},
  legacyStateMode: (state: Record<string, unknown>) => boolean = () => false,
) {
  return (save: SaveEnvelope): SaveEnvelope => {
    const descriptor = getGameDefinition(slug);
    const data = migrate(save);
    if (!descriptor.modes.some((mode) => mode.id === data.mode))
      throw new Error("This game mode is unavailable.");
    validateConfig({ ...descriptor.config, ...data.config });
    const state = parseState(data.state);
    if (!legacyStateMode(state)) {
      if (typeof state.mode === "string" && state.mode !== data.mode)
        throw new Error("The saved mode does not match its game state.");
    }
    if (
      typeof state.difficulty === "string" &&
      state.difficulty !== data.difficulty
    )
      throw new Error("The saved difficulty does not match its game state.");
    return { ...data, format: 2, state };
  };
}
