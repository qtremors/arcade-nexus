import { createCodec } from "../saveCodec";
import { getGameDefinition } from "../catalog";
import { z } from "zod";
import { scoreSchema } from "../../contracts/gameplay";
const lane = z.number().int().min(0).max(2);
export const row = z.object({
  id: z.number().int().nonnegative(),
  z: z.number().min(-120).max(8),
  safe: lane,
  passed: z.boolean(),
});
const schema = z.object({
  version: z.literal(1),
  rhythm: z.number().int().min(0).max(3).default(0),
  beat: z.number().int().min(0).max(5).default(0),
  lane,
  x: z.number().min(-2.8).max(2.8),
  rows: z.array(row).max(12),
  distance: z.number().nonnegative(),
  score: scoreSchema,
  crystals: z.number().int().nonnegative(),
  lives: z.number().int().min(0).max(3),
  elapsed: z.number().nonnegative(),
  spawn: z.number().min(0).max(2),
  nextId: z.number().int().nonnegative(),
  invulnerable: z.number().min(0).max(1),
  difficulty: z.enum(["easy", "normal", "hard"]),
  random: z.number().int().min(0).max(0xffffffff),
});
export const parseState = (state: Record<string, unknown>) =>
  schema.parse(state);

export const decodeSave = createCodec("prism-rush", parseState, (save) => ({
  ...save,
  rules_version: getGameDefinition("prism-rush").rulesVersion,
}));
