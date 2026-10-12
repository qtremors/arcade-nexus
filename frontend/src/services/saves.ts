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
  const result = envelopeSchema.parse(value);
  if (result.game !== slug)
    throw new Error("This save belongs to another game.");
  const descriptor = getDescriptor(slug);
  if (result.rules_version > descriptor.rulesVersion)
    throw new Error("Update Arcade Nexus to open this newer save.");
  if (!descriptor.modes.some((mode) => mode.id === result.mode))
    throw new Error("This game mode is unavailable.");
  return { ...result, format: 2 };
}
