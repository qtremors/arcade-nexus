import { createCodec } from "../saveCodec";
import { z } from "zod";
import { scoreSchema, limits } from "../../contracts/gameplay";
const finite = z.number().finite();
const body = z.object({
  x: finite.min(0).max(960),
  y: finite.min(0).max(640),
  vx: finite.min(-1000).max(1000),
  vy: finite.min(-1000).max(1000),
});
export const rockSchema = body.extend({
  size: z.number().int().min(1).max(3),
  angle: finite,
});
export const bulletSchema = body.extend({ life: z.number().min(0).max(2) });
const schema = z.object({
  version: z.literal(1),
  ship: body.extend({ angle: finite }),
  rocks: z.array(rockSchema).max(256),
  bullets: z.array(bulletSchema).max(64),
  score: scoreSchema,
  lives: z.number().int().min(0).max(3),
  wave: z
    .number()
    .int()
    .min(1)
    .max(limits.count + 1),
  invulnerable: z.number().min(0).max(3),
  cooldown: z.number().min(0).max(1),
  intermission: z.number().min(0).max(2),
  elapsed: z.number().nonnegative(),
  difficulty: z.enum(["easy", "normal", "hard"]),
  random: z.number().int().min(0).max(0xffffffff),
});
export const parseState = (state: Record<string, unknown>) =>
  schema.parse(state);

export const decodeSave = createCodec("asteroids", parseState, (save) => save);
