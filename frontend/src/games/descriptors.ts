import { getGameDefinition } from "./catalog";
import type { GameInstance } from "../sdk/GameSDK";
import { getExperience } from "./experience";

const loaders: Record<string, () => Promise<GameInstance>> = {
  tetris: async () => new (await import("./tetris/Tetris")).TetrisGame(),
  asteroids: async () =>
    new (await import("./asteroids/Asteroids")).AsteroidsGame(),
  "prism-rush": async () =>
    new (await import("./prism-rush/PrismRush")).PrismRushGame(),
  snake: async () => new (await import("./snake/Snake")).SnakeGame(),
  "raptor-run": async () =>
    new (await import("./raptor-run/RaptorRun")).RaptorRunGame(),
  breakout: async () =>
    new (await import("./breakout/Breakout")).BreakoutGame(),
  "merge-2048": async () =>
    new (await import("./merge-2048/Merge2048")).Merge2048Game(),
  "stellar-flight": async () =>
    new (await import("./stellar-flight/StellarFlight")).StellarFlightGame(),
};
const codecs: Record<
  string,
  () => Promise<{
    parseState: (state: Record<string, unknown>) => Record<string, unknown>;
    decodeSave: (
      save: import("../contracts/saves").SaveEnvelope,
    ) => import("../contracts/saves").SaveEnvelope;
  }>
> = {
  snake: () => import("./snake/codec"),
  "raptor-run": () => import("./raptor-run/codec"),
  breakout: () => import("./breakout/codec"),
  "merge-2048": () => import("./merge-2048/codec"),
  tetris: () => import("./tetris/codec"),
  asteroids: () => import("./asteroids/codec"),
  "prism-rush": () => import("./prism-rush/codec"),
  "stellar-flight": () => import("./stellar-flight/codec"),
};
export function getDescriptor(slug: string) {
  if (!loaders[slug])
    throw new Error("This game is not bundled with Arcade Nexus");
  return {
    ...getGameDefinition(slug),
    slug,
    experience: getExperience(slug),
    load: loaders[slug],
    codec: codecs[slug],
  };
}
export { gameSlugs } from "./catalog";
