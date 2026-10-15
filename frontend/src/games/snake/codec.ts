import { createCodec } from "../saveCodec";
import { getGameDefinition } from "../catalog";
import { z } from "zod";
import { scoreSchema } from "../../contracts/gameplay";
import { MAZE_NAMES } from "./mazes";

export function parseState(state: Record<string, unknown>) {
  const point = z.object({
    x: z.number().int().nonnegative(),
    y: z.number().int().nonnegative(),
  });
  const direction = z.enum(["up", "down", "left", "right"]);
  const data = z
    .object({
      version: z.literal(1),
      randomState: z.number().int().min(0).max(4294967295).default(42),
      mode: z
        .enum(["classic", "maze", "sprint", "sprint-plus"])
        .default("classic"),
      elapsed: z.number().min(0).max(604800000).default(0),
      mazeIndex: z
        .number()
        .int()
        .min(0)
        .max(MAZE_NAMES.length - 1)
        .default(0),
      bonus: point
        .extend({ expires: z.number().min(0).max(65000) })
        .nullable()
        .default(null),
      bonusAt: z.number().min(10000).max(70000).default(10000),
      bonuses: z.number().int().min(0).max(6).default(0),
      walls: z.array(point).max(400).default([]),
      cellSize: z.number().min(20).max(40).default(28),
      score: scoreSchema,
      snake: z.array(point).min(3).max(10000),
      food: point,
      direction,
      nextDirection: direction,
      cols: z.number().int().min(6).max(200),
      rows: z.number().int().min(6).max(200),
      moveTimer: z.number().nonnegative().max(150),
      moveInterval: z.number().min(60).max(150),
      lastTail: point.nullable(),
      turns: z.array(direction).max(2).default([]),
    })
    .parse(state);
  const occupied = new Set(data.snake.map((p) => `${p.x},${p.y}`));
  if (
    occupied.size !== data.snake.length ||
    [...data.snake, ...data.walls, data.food].some(
      (p) => p.x >= data.cols || p.y >= data.rows,
    ) ||
    occupied.has(`${data.food.x},${data.food.y}`) ||
    data.walls.some(
      (p) =>
        occupied.has(`${p.x},${p.y}`) ||
        (p.x === data.food.x && p.y === data.food.y),
    )
  )
    throw new Error("Invalid Snake save");
  if (
    data.bonus &&
    (data.bonus.x >= data.cols ||
      data.bonus.y >= data.rows ||
      occupied.has(`${data.bonus.x},${data.bonus.y}`) ||
      data.walls.some((p) => p.x === data.bonus!.x && p.y === data.bonus!.y))
  )
    throw new Error("Invalid bonus packet");
  return data;
}

export const decodeSave = createCodec("snake", parseState, (save) => ({
  ...save,
  rules_version: getGameDefinition("snake").rulesVersion,
}));
