export interface GameMeasurement {
  slug: string;
  recordedAt: string;
  launchMs: number;
  frames: number;
  p50: number;
  p95: number;
  slowFrames: number;
}
const key = "nexus-performance";
export function recentMeasurements(): GameMeasurement[] {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "[]");
  } catch {
    return [];
  }
}
export function recordMeasurement(
  slug: string,
  launchMs: number,
  samples: number[],
) {
  if (!samples.length) return;
  const sorted = [...samples].sort((a, b) => a - b);
  const value = {
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
  try {
    localStorage.setItem(
      key,
      JSON.stringify([value, ...recentMeasurements()].slice(0, 10)),
    );
  } catch {
    /* Measurements are optional. */
  }
}
