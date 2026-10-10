import { beforeEach, it, expect, vi } from "vitest";
import { statsApi, achievementsApi } from "../api/client";
import {
  enqueueCompletion,
  flushCompletions,
  sendCompletion,
} from "../services/sessionQueue";
import type { Completion } from "../services/sessionQueue";
const item = (): Completion => ({
  slug: "snake",
  sessionId: crypto.randomUUID(),
  profileId: 7,
  seconds: 10,
  score: 50,
  difficulty: "normal",
  metrics: {},
});
beforeEach(() => {
  localStorage.clear();
  vi.spyOn(statsApi, "recordSession").mockResolvedValue({});
  vi.spyOn(statsApi, "submitScore").mockResolvedValue({
    high_score: 50,
    is_new_high_score: true,
  });
  vi.spyOn(achievementsApi, "getForGame").mockResolvedValue({
    achievements: [],
    total: 0,
    unlocked_count: 0,
  });
});
it("keeps results with their profile identity and coalesces duplicate sends", async () => {
  const result = item();
  enqueueCompletion(result);
  await Promise.all([sendCompletion(result), sendCompletion(result)]);
  expect(statsApi.recordSession).toHaveBeenCalledTimes(1);
  expect(statsApi.recordSession).toHaveBeenCalledWith(
    "snake",
    10,
    50,
    "normal",
    result.sessionId,
    7,
    {},
  );
  expect(
    Object.keys(localStorage).filter((k) => k.startsWith("nexus-result-v1:")),
  ).toHaveLength(0);
});
it("retains an unsuccessful result for a later retry", async () => {
  const result = item();
  enqueueCompletion(result);
  vi.mocked(statsApi.recordSession).mockRejectedValueOnce(new Error("offline"));
  await flushCompletions();
  expect(
    localStorage.getItem(`nexus-result-v1:${result.sessionId}`),
  ).not.toBeNull();
  await flushCompletions();
  expect(
    localStorage.getItem(`nexus-result-v1:${result.sessionId}`),
  ).toBeNull();
});
it("storing one result never overwrites another session", async () => {
  const first = item(),
    second = item();
  enqueueCompletion(first);
  enqueueCompletion(second);
  await sendCompletion(first);
  expect(
    localStorage.getItem(`nexus-result-v1:${second.sessionId}`),
  ).not.toBeNull();
  await sendCompletion(second);
});
it("rejects corrupt queued payloads", () => {
  expect(() => enqueueCompletion({ ...item(), seconds: -1 })).toThrow();
});
