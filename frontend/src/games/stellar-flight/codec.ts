import { createCodec } from "../saveCodec";
import { getGameDefinition } from "../catalog";
import { z } from "zod";
import { ROUTES } from "./routes";
import { SHIPS } from "./ships";
import { contracts } from "./contracts";
const count = z.number().int().min(0).max(1e12);
const positive = z.number().min(0).max(1e15);
const vector = z.tuple([
  z.number().min(-1e15).max(1e15),
  z.number().min(-1e15).max(1e15),
  z.number().min(-1e15).max(1e15),
]);
const quaternion = z
  .tuple([
    z.number().min(-1).max(1),
    z.number().min(-1).max(1),
    z.number().min(-1).max(1),
    z.number().min(-1).max(1),
  ])
  .refine((q) => Math.abs(q.reduce((sum, n) => sum + n * n, 0) - 1) < 0.01);
export const gateSchema = z.object({ position: vector, rotation: quaternion });
const countersSchema = z.object({
  gates: positive,
  sectors: positive,
  closePasses: positive,
  distance: positive,
  races: positive,
});
export const raceResultSchema = z.object({
  time: positive,
  passed: z.number().int().min(0).max(5),
  medal: z.enum(["gold", "silver", "bronze"]),
  points: count,
  pace: positive.default(0),
});
const journeySchema = z
  .object({
    version: z.literal(2),
    mode: z.literal("endless"),
    seed: z.number().int().min(0).max(0xffffffff),
    rng: z.number().int().min(0).max(0xffffffff),
    position: vector,
    rotation: quaternion,
    speed: z.number().min(0).max(2000),
    bestSpeed: z.number().min(0).max(2000),
    maxAltitude: positive,
    routeHeld: z.boolean(),
    shipHeld: z.boolean(),
    elapsed: positive,
    distance: positive,
    xp: positive,
    score: z.number().int().min(0).max(2147483647),
    ship: z.enum(["jet", "dart", "twin", "crescent"]),
    energy: z.number().min(0).max(100),
    shield: z.number().min(0).max(100),
    boostLocked: z.boolean(),
    invulnerable: z.number().min(0).max(3),
    gatesPassed: count,
    gatesMissed: count,
    combo: count,
    bestCombo: count,
    races: count,
    collisions: count,
    nearMisses: count,
    nearMissCooldown: z.number().min(0).max(2),
    raceTime: positive.default(0),
    racePar: positive.default(30),
    bestRace: positive.nullable().default(null),
    bestPace: positive.nullable().default(null),
    raceLength: positive.default(0),
    lastRace: raceResultSchema.nullable().default(null),
    contractIndex: count.default(0),
    contractHeld: z.boolean().default(false),
    contractChoice: z
      .number()
      .int()
      .min(0)
      .max(contracts.length - 1)
      .optional(),
    routeStyle: z
      .number()
      .int()
      .min(0)
      .max(ROUTES.length - 1)
      .default(0),
    contractBaseline: countersSchema.default({
      gates: 0,
      sectors: 1,
      closePasses: 0,
      distance: 0,
      races: 0,
    }),
    scanned: z
      .array(z.string().regex(/^-?\d+:-?\d+:-?\d+$/))
      .max(1000000)
      .default([]),
    navigation: z.enum(["race", "explore"]).default("race"),
    navigationHeld: z.boolean().default(false),
    cameraView: z.enum(["chase", "nose", "wide"]).default("chase"),
    cameraHeld: z.boolean().default(false),
    pitchVelocity: z.number().min(-2).max(2).default(0),
    yawVelocity: z.number().min(-2).max(2).default(0),
    racePassed: z.number().int().min(0).max(5),
    gateIndex: z.number().int().min(0).max(4),
    gates: z.array(gateSchema).length(5),
    visited: z
      .array(z.string().regex(/^-?\d+:-?\d+:-?\d+$/))
      .min(1)
      .max(1000000),
  })
  .superRefine((state, context) => {
    const level = levelForXP(state.xp);
    if (SHIPS.find((s) => s.id === state.ship)!.level > level)
      context.addIssue({
        code: "custom",
        message: "Ship has not been unlocked",
      });
    if (
      state.racePassed > state.gateIndex ||
      state.combo > state.bestCombo ||
      new Set(state.visited).size !== state.visited.length ||
      new Set(state.scanned).size !== state.scanned.length
    )
      context.addIssue({
        code: "custom",
        message: "Inconsistent journey progress",
      });
  });
const legacySchema = z.object({
  version: z.literal(1),
  mode: z.enum(["classic", "course"]).default("classic"),
  position: vector,
  rotation: quaternion,
  speed: z.number().min(0).max(450),
  bestSpeed: z.number().min(0).max(450),
  elapsed: positive.default(0),
  maxAltitude: positive,
  map: z.number().int().min(0).max(2),
  gatesPassed: count.default(0),
  gatesMissed: count.default(0),
  gate: gateSchema.nullable().default(null),
});
export function levelForXP(xp: number): number {
  return 1 + Math.floor(Math.sqrt(xp / 400));
}
export function nextLevelXP(level: number): number {
  return 400 * level * level;
}

export const parseState = (state: Record<string, unknown>) =>
  state.version === 1 ? legacySchema.parse(state) : journeySchema.parse(state);
export { legacySchema, journeySchema };

export const decodeSave = createCodec(
  "stellar-flight",
  parseState,
  (save) => ({
    ...save,
    mode:
      save.rules_version <= 2 && ["classic", "course"].includes(save.mode)
        ? "endless"
        : save.mode,
    rules_version: getGameDefinition("stellar-flight").rulesVersion,
  }),
  undefined,
  (state) => state.version === 1,
);
