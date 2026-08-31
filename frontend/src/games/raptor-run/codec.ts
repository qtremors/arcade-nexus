import { createCodec } from "../saveCodec";
import { getGameDefinition } from "../catalog";
import { z } from "zod";
import { scoreSchema, countSchema } from "../../contracts/gameplay";
import { PHRASES } from "./phrases";

export function parseState(state: Record<string, unknown>) {
  const data = z
    .object({
      version: z.literal(1),
      randomState: z.number().int().min(0).max(4294967295).default(42),
      phraseIndex: z
        .number()
        .int()
        .min(0)
        .max(PHRASES.length - 1)
        .default(0),
      phraseStep: z.number().int().min(0).max(3).default(0),
      pattern: z.number().int().min(0).max(1000000).default(0),
      nearMisses: z.number().int().min(0).max(1000000).default(0),
      milestone: z.number().int().min(0).max(10000000).default(0),
      gravity: z.number().min(1800).max(3000).default(2500),
      jumpForce: z.number().min(700).max(950).default(850),
      initialSpeed: z.number().min(250).max(500).default(400),
      jumps: countSchema,
      difficulty: z.enum(["easy", "normal", "hard"]),
      score: scoreSchema,
      distance: z.number().nonnegative().max(21474836470),
      raptorY: z.number().min(-1000).max(1000),
      raptorVelocity: z.number().min(-2000).max(3000),
      isJumping: z.boolean(),
      isDucking: z.boolean(),
      gameSpeed: z.number().min(0).max(1200),
      dayTime: z.number().min(0).max(1),
      spawnTimer: z.number().min(0).max(4000),
      spawnInterval: z.number().min(600).max(4000),
      jumpBuffer: z.number().min(0).max(0.12).default(0),
      obstacles: z
        .array(
          z.object({
            x: z.number().min(-100).max(1200),
            y: z.number().min(0).max(1000),
            width: z.number().min(1).max(100),
            height: z.number().min(1).max(100),
            type: z.enum(["cactus", "rock", "bird"]),
            closest: z.number().min(0).max(1000).optional(),
          }),
        )
        .max(20),
    })
    .parse(state);
  if (data.phraseStep >= PHRASES[data.phraseIndex].hazards.length)
    throw new Error("Invalid obstacle phrase");
  return data;
}

export const decodeSave = createCodec(
  "raptor-run",
  parseState,
  (save) => ({
    ...save,
    rules_version: getGameDefinition("raptor-run").rulesVersion,
    config:
      save.rules_version < getGameDefinition("raptor-run").rulesVersion
        ? {
            ...save.config,
            ...(save.config.gravity === 1500 ? { gravity: 2500 } : {}),
            ...(save.config.jump_force === 600 ? { jump_force: 850 } : {}),
          }
        : save.config,
  }),
  (config) => {
    z.object({
      gravity: z.number().min(1800).max(3000).default(2500),
      jump_force: z.number().min(700).max(950).default(850),
      initial_speed: z.number().min(250).max(500).default(400),
    }).parse(config);
  },
);
