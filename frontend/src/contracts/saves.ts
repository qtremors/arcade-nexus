import { z } from "zod";
import { scoreSchema, limits } from "./gameplay";
export const envelopeSchema = z.object({
  format: z.union([z.literal(1), z.literal(2)]),
  game: z.string(),
  difficulty: z.enum(["easy", "normal", "hard"]),
  state: z.record(z.string(), z.unknown()),
  mode: z.string().default("classic"),
  rules_version: z
    .number()
    .int()
    .positive()
    .max(limits.rules_version)
    .default(1),
  config: z.record(z.string(), z.unknown()).default({}),
  session_id: z.string().optional(),
  saved_at: z.string().optional(),
  score: scoreSchema.default(0),
});
export type SaveEnvelope = z.infer<typeof envelopeSchema>;
