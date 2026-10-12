import { z } from "zod";
import catalog from "../../../catalog.json";
import type { GameInstance } from "../sdk/GameSDK";
import { getExperience } from "./experience";

const schema = z.record(
  z.string(),
  z.object({
    title: z.string(),
    rulesVersion: z.number().int().positive(),
    scoreUnit: z.string(),
    difficulty: z.boolean(),
    modes: z.array(z.object({ id: z.string(), label: z.string() })).min(1),
    config: z.record(z.string(), z.unknown()),
  }),
);
const definitions = schema.parse(catalog);
const loaders: Record<string, () => Promise<GameInstance>> = {
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
export function getDescriptor(slug: string) {
  if (!definitions[slug] || !loaders[slug])
    throw new Error("This game is not bundled with Arcade Nexus");
  return {
    ...definitions[slug],
    slug,
    experience: getExperience(slug),
    load: loaders[slug],
  };
}
export const gameSlugs = Object.keys(definitions);
