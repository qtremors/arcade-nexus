import { beforeEach, expect, it } from "vitest";
import { recentMeasurements, recordMeasurement } from "../performance";
beforeEach(() => localStorage.clear());
const sample = {
  slug: "snake",
  recordedAt: "2026-10-14T00:00:00.000Z",
  launchMs: 20,
  frames: 60,
  p50: 16.7,
  p95: 20,
  slowFrames: 0,
};
it.each(["null", "{}", '"text"', "invalid json"])(
  "ignores malformed stored performance data: %s",
  (stored) => {
    localStorage.setItem("nexus-performance", stored);
    expect(recentMeasurements()).toEqual([]);
  },
);
it("retains valid legacy samples while filtering invalid fields and bounding history", () => {
  localStorage.setItem(
    "nexus-performance",
    JSON.stringify([
      null,
      { ...sample, frames: -1 },
      { ...sample, p95: 1 },
      { ...sample, slowFrames: 61 },
      ...Array.from({ length: 12 }, () => sample),
    ]),
  );
  expect(recentMeasurements()).toHaveLength(10);
  expect(recentMeasurements()[0]).toEqual(sample);
});
it("repairs an invalid history when recording a valid sample and uses the explicit 60 FPS target", () => {
  localStorage.setItem("nexus-performance", "null");
  recordMeasurement("snake", 20, [16.7, 16.7, NaN, 0]);
  expect(recentMeasurements()[0]).toMatchObject({
    slug: "snake",
    frames: 2,
    targetFps: 60,
  });
  recordMeasurement("snake", NaN, [16.7]);
  expect(recentMeasurements()).toHaveLength(1);
});
