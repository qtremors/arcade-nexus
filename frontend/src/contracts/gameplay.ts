import { z } from "zod";
import limits from "../../../contracts/gameplay-limits.json";

export { limits };
export const scoreSchema = z.number().int().min(0).max(limits.score);
export const countSchema = z.number().int().min(0).max(limits.count);
const count = countSchema;
export const metricsSchema = z.object({
  ended: z.boolean().optional(),
  jumps: count.optional(),
  max_altitude: z.number().min(0).max(limits.max_altitude).optional(),
  crashed: z.boolean().optional(),
  gates: count.optional(),
  misses: count.optional(),
  sectors: count.optional(),
  lives: z.number().int().min(0).max(limits.lives).optional(),
  highest_tile: z.number().int().min(0).max(limits.highest_tile).optional(),
  completed: z.boolean().optional(),
  elapsed_ms: z.number().int().min(1).max(limits.elapsed_ms).optional(),
  medal: z.enum(["gold", "silver", "bronze"]).optional(),
  max_speed: z.number().min(0).max(limits.max_speed).optional(),
});
export type GameMetrics = z.infer<typeof metricsSchema>;

export function checkedScore(value: number): number {
  if (!scoreSchema.safeParse(value).success)
    throw new Error(
      "The supported score limit has been reached. Your previous saves remain available.",
    );
  return value;
}

export function checkedCount(value: number): number {
  if (!countSchema.safeParse(value).success)
    throw new Error(
      "The supported progress limit has been reached. Your previous saves remain available.",
    );
  return value;
}
