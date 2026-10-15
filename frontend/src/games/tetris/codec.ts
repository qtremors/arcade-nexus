import { createCodec } from "../saveCodec";
import { getGameDefinition } from "../catalog";
import { z } from "zod";
import { scoreSchema } from "../../contracts/gameplay";
import { rotations } from "./geometry";
const kind = z.number().int().min(0).max(6);
const count = z.number().int().nonnegative();
const schema = z.object({
  version: z.literal(1),
  board: z.array(z.array(z.number().int().min(0).max(7)).length(10)).length(20),
  piece: kind,
  rotation: z.number().int().min(0).max(3),
  x: z.number().int().min(-3).max(9),
  y: z.number().int().min(-4).max(19),
  queue: z.array(kind).min(3).max(14),
  held: kind.nullable(),
  canHold: z.boolean(),
  score: scoreSchema,
  lines: count,
  elapsed: z.number().nonnegative(),
  fall: z.number().nonnegative(),
  lock: z.number().nonnegative(),
  resets: count.max(12),
  terminal: z.boolean(),
  mode: z.enum(["marathon", "sprint"]),
  difficulty: z.enum(["easy", "normal", "hard"]),
  random: count.max(0xffffffff),
});

export function parseState(state: Record<string, unknown>) {
  const data = schema.parse(state);
  if (!data.terminal && data.board.some((row) => row.every(Boolean)))
    throw new Error("The saved stack contains an uncleared row");
  if (
    !data.terminal &&
    rotations[data.piece][data.rotation].some((row, y) =>
      row.some(
        (cell, x) =>
          cell &&
          (data.x + x < 0 ||
            data.x + x >= 10 ||
            data.y + y >= 20 ||
            (data.y + y >= 0 && data.board[data.y + y][data.x + x])),
      ),
    )
  )
    throw new Error("The saved piece overlaps the stack");
  return data;
}

export const decodeSave = createCodec("tetris", parseState, (save) => ({
  ...save,
  rules_version: getGameDefinition("tetris").rulesVersion,
}));
