import { z } from "zod";
import { getDescriptor } from "../games/descriptors";
export const envelopeSchema = z.object({
  format: z.union([z.literal(1), z.literal(2)]),
  game: z.string(),
  difficulty: z.enum(["easy", "normal", "hard"]),
  state: z.record(z.string(), z.unknown()),
  mode: z.string().default("classic"),
  rules_version: z.number().int().positive().default(1),
  config: z.record(z.string(), z.unknown()).default({}),
  session_id: z.string().optional(),
  saved_at: z.string().optional(),
  score: z.number().default(0),
});
export type SaveEnvelope = z.infer<typeof envelopeSchema>;
export function readSave(value: unknown, slug: string): SaveEnvelope {
  let result = envelopeSchema.parse(value);
  if (result.game !== slug)
    throw new Error("This save belongs to another game.");
  const descriptor = getDescriptor(slug);
  if (result.rules_version > descriptor.rulesVersion)
    throw new Error("Update Arcade Nexus to open this newer save.");
  // Old flight modes share one continuous journey now; state migration is validated by the game.
  if (
    slug === "stellar-flight" &&
    result.rules_version <= 2 &&
    ["classic", "course"].includes(result.mode)
  )
    result = {
      ...result,
      mode: "endless",
      rules_version: descriptor.rulesVersion,
      config: { ...result.config, mode: "endless" },
    };
  if (
    slug === "stellar-flight" &&
    result.mode === "endless" &&
    result.rules_version < descriptor.rulesVersion
  )
    result = { ...result, rules_version: descriptor.rulesVersion };
  // Preserve historical records; resumed runs use the current validated rules.
  if (slug === "raptor-run" && result.rules_version < descriptor.rulesVersion) {
    // The original catalog stored these unused physics values. Older games
    // ignored them; applying them now would reject otherwise valid saves.
    result = {
      ...result,
      config: {
        ...result.config,
        ...(result.config.gravity === 1500
          ? { gravity: descriptor.config.gravity }
          : {}),
        ...(result.config.jump_force === 600
          ? { jump_force: descriptor.config.jump_force }
          : {}),
      },
    };
  }
  if (
    ["snake", "raptor-run", "merge-2048", "tetris", "prism-rush"].includes(
      slug,
    ) &&
    result.rules_version < descriptor.rulesVersion
  )
    result = { ...result, rules_version: descriptor.rulesVersion };
  if (!descriptor.modes.some((mode) => mode.id === result.mode))
    throw new Error("This game mode is unavailable.");
  return { ...result, format: 2 };
}
