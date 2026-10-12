import { beforeEach, it, expect, vi } from "vitest";
import { progressApi, ApiError } from "../api/client";
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
  vi.spyOn(progressApi, "complete").mockResolvedValue({
    high_score: 50,
    is_new_high_score: true,
    awards: [],
  });
});
it("keeps results with their profile identity and coalesces duplicate sends", async () => {
  const result = item();
  enqueueCompletion(result);
  await Promise.all([sendCompletion(result), sendCompletion(result)]);
  expect(progressApi.complete).toHaveBeenCalledTimes(1);
  expect(progressApi.complete).toHaveBeenCalledWith(
    "snake",
    {
      session_id: result.sessionId,
      playtime_seconds: 10,
      score: 50,
      difficulty: "normal",
      mode: "classic",
      rules_version: 1,
      metrics: {},
    },
    7,
  );
  expect(
    Object.keys(localStorage).filter((k) => k.startsWith("nexus-result-v1:")),
  ).toHaveLength(0);
});
it("retains an unsuccessful result for a later retry", async () => {
  const result = item();
  enqueueCompletion(result);
  vi.mocked(progressApi.complete).mockRejectedValueOnce(new Error("offline"));
  await flushCompletions();
  expect(
    localStorage.getItem(`nexus-result-v1:${result.sessionId}`),
  ).not.toBeNull();
  await flushCompletions(true);
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

it("retains a permanent failure without automatic retry and allows an explicit retry", async () => {
  const result = item();
  enqueueCompletion(result);
  vi.mocked(progressApi.complete).mockRejectedValueOnce(
    new ApiError("Profile not found", 404),
  );
  await flushCompletions();
  expect(
    JSON.parse(localStorage.getItem(`nexus-result-v1:${result.sessionId}`)!),
  ).toMatchObject({ blocked: true });
  const calls = vi.mocked(progressApi.complete).mock.calls.length;
  await flushCompletions();
  expect(progressApi.complete).toHaveBeenCalledTimes(calls);
  await flushCompletions(true);
  expect(
    localStorage.getItem(`nexus-result-v1:${result.sessionId}`),
  ).toBeNull();
});
