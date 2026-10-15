import { createCodec } from "../saveCodec";
import { getGameDefinition } from "../catalog";
import { z } from "zod";
import { scoreSchema } from "../../contracts/gameplay";
import { PUZZLES } from "./puzzles";
import { limits } from "../../contracts/gameplay";

export function parseState(state: Record<string, unknown>) {
  const data = z
    .object({
      version: z.literal(1),
      randomState: z.number().int().min(0).max(4294967295).default(42),
      mode: z.enum(["classic", "challenge", "daily"]).default("classic"),
      puzzle: z
        .number()
        .int()
        .min(0)
        .max(PUZZLES.length - 1)
        .default(0),
      moves: z.number().int().nonnegative().max(1000000).default(0),
      board: z
        .array(
          z
            .number()
            .int()
            .min(0)
            .max(limits.highest_tile)
            .refine((n) => n === 0 || (n >= 2 && (n & (n - 1)) === 0)),
        )
        .length(16),
      score: scoreSchema,
      undo: z
        .object({
          randomState: z.number().int().min(0).max(4294967295).optional(),
          board: z
            .array(
              z
                .number()
                .int()
                .min(0)
                .max(limits.highest_tile)
                .refine((n) => n === 0 || (n >= 2 && (n & (n - 1)) === 0)),
            )
            .length(16),
          score: scoreSchema,
        })
        .nullable()
        .default(null),
    })
    .parse(state);
  return data;
}

export const decodeSave = createCodec("merge-2048", parseState, (save) => ({
  ...save,
  rules_version: getGameDefinition("merge-2048").rulesVersion,
}));
