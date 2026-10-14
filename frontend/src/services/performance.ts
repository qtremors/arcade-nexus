import type { GameRenderInfo } from "../sdk/GameSDK";
import { z } from "zod";
const nonnegative = z.number().finite().nonnegative();
const measurementSchema = z
  .object({
    slug: z.string().min(1),
    recordedAt: z.iso.datetime({ offset: true }),
    launchMs: nonnegative,
    frames: z.number().int().positive(),
    p50: nonnegative,
    p95: nonnegative,
    slowFrames: z.number().int().nonnegative(),
    averageFps: nonnegative.optional(),
    targetFps: z.number().finite().positive().optional(),
    renderer: z.string().nullable().optional(),
    quality: z.string().optional(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
  })
  .refine(
    (value) => value.p95 >= value.p50 && value.slowFrames <= value.frames,
  );
export type GameMeasurement = z.infer<typeof measurementSchema>;
const key = "nexus-performance";
export function recentMeasurements(): GameMeasurement[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
    if (!Array.isArray(stored)) return [];
    const measurements: GameMeasurement[] = [];
    for (const entry of stored) {
      const parsed = measurementSchema.safeParse(entry);
      if (parsed.success) measurements.push(parsed.data);
      if (measurements.length === 10) break;
    }
    return measurements;
  } catch {
    return [];
  }
}
export function recordMeasurement(
  slug: string,
  launchMs: number,
  samples: number[],
  renderInfo: GameRenderInfo = {},
) {
  samples = samples.filter((n) => Number.isFinite(n) && n > 0);
  if (!samples.length) return;
  const sorted = [...samples].sort((a, b) => a - b);
  const value = {
    ...renderInfo,
    targetFps: renderInfo.targetFps ?? 60,
    averageFps:
      Math.round(
        (10000 * samples.length) / samples.reduce((sum, n) => sum + n, 0),
      ) / 10,
    slug,
    recordedAt: new Date().toISOString(),
    launchMs: Math.round(launchMs),
    frames: samples.length,
    p50: Math.round(sorted[Math.floor(sorted.length * 0.5)] * 10) / 10,
    p95:
      Math.round(
        sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] *
          10,
      ) / 10,
    slowFrames: samples.filter((n) => n > 33.4).length,
  };
  const parsed = measurementSchema.safeParse(value);
  if (!parsed.success) return;
  try {
    localStorage.setItem(
      key,
      JSON.stringify([parsed.data, ...recentMeasurements()].slice(0, 10)),
    );
  } catch {
    /* Measurements are optional. */
  }
}
