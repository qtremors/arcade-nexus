import { z } from "zod";
import catalog from "../../../catalog.json";
const schema = z.record(
  z.string(),
  z.object({
    title: z.string(),
    rulesVersion: z.number().int().positive(),
    scoreUnit: z.string(),
    difficulty: z.boolean(),
    modes: z
      .array(
        z.object({
          id: z.string(),
          label: z.string(),
          ranking: z.enum(["points", "time"]).default("points"),
          rankingSince: z.number().int().positive().default(1),
        }),
      )
      .min(1),
    config: z.record(z.string(), z.unknown()),
  }),
);
const definitions = schema.parse(catalog);

export function getGameDefinition(slug: string) {
  const definition = definitions[slug];
  if (!definition)
    throw new Error("This game is not bundled with Arcade Nexus");
  return definition;
}
export const gameSlugs = Object.keys(definitions);
