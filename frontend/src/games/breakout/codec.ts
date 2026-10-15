import { createCodec } from "../saveCodec";
import { z } from "zod";
import { scoreSchema } from "../../contracts/gameplay";

export function parseState(state: Record<string, unknown>) {
  const ballSchema = z.object({
    x: z.number().min(-8).max(968),
    y: z.number().min(-8).max(649),
    vx: z.number().min(-600).max(600),
    vy: z.number().min(-600).max(600),
  });
  const data = z
    .object({
      version: z.literal(1),
      extraBalls: z.array(ballSchema).max(2).default([]),
      pickups: z
        .array(
          z.object({
            x: z.number().min(0).max(960),
            y: z.number().min(0).max(660),
            kind: z.enum(["wide", "multi"]),
          }),
        )
        .max(20)
        .default([]),
      wideTime: z.number().min(0).max(12).default(0),
      multiTime: z.number().min(0).max(10).default(0),
      armor: z.array(z.number().int().min(0).max(2)).length(60).optional(),
      elapsed: z.number().min(0).max(604800000).default(0),
      sinceHit: z.number().min(0).max(604800000).default(0),
      randomState: z.number().int().min(0).max(4294967295).default(42),
      mode: z.enum(["classic", "daily", "arcade"]).default("classic"),
      stage: z.number().int().min(1).max(6).default(1),
      paddle: z.number().min(0).max(960),
      ball: z.object({
        x: z.number().min(-8).max(968),
        y: z.number().min(-8).max(649),
        vx: z.number().min(-600).max(600),
        vy: z.number().min(-600).max(600),
      }),
      bricks: z.array(z.boolean()).length(60),
      score: scoreSchema,
      lives: z.number().int().min(1).max(3),
      launched: z.boolean(),
      difficulty: z.enum(["easy", "normal", "hard"]),
    })
    .parse(state);
  if (
    data.mode !== "arcade" &&
    (data.stage > 3 ||
      data.extraBalls.length ||
      data.pickups.length ||
      data.wideTime ||
      data.multiTime)
  )
    throw new Error("Arcade power-ups do not belong to campaign saves");
  return data;
}

export const decodeSave = createCodec("breakout", parseState, (save) => save);
