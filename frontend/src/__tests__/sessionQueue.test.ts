import { beforeEach, it, expect, vi } from "vitest";
import { progressApi, ApiError } from "../api/client";
import {
  enqueueCompletion,
  flushCompletions,
  sendCompletion,
  pendingResults,
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
    session_id: crypto.randomUUID(),
    previous_high_score: 0,
    best_time_ms: null,
    previous_best_time_ms: null,
    is_new_best_time: false,
    medal: null,
    total_playtime: 10,
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

it("removes durable results acknowledged by another tab instead of resending cached copies", async () => {
  const result = item();
  enqueueCompletion(result);
  localStorage.removeItem(`nexus-result-v1:${result.sessionId}`);
  expect(pendingResults()).not.toContainEqual(
    expect.objectContaining({ sessionId: result.sessionId }),
  );
  await flushCompletions();
  expect(progressApi.complete).not.toHaveBeenCalled();
});
it("keeps updated retry details in memory when storage writes fail", async () => {
  const result = item();
  enqueueCompletion(result);
  const write = vi
    .spyOn(Storage.prototype, "setItem")
    .mockImplementation(() => {
      throw new DOMException("Full", "QuotaExceededError");
    });
  vi.mocked(progressApi.complete).mockRejectedValueOnce(
    new ApiError("invalid result", 422),
  );
  await expect(sendCompletion(result)).rejects.toThrow("invalid result");
  expect(
    pendingResults().find((value) => value.sessionId === result.sessionId),
  ).toMatchObject({ attempts: 1, blocked: true, error: "invalid result" });
  write.mockRestore();
  await flushCompletions(true);
  expect(pendingResults()).toHaveLength(0);
});
it("does not resurrect another tab's completed result after an in-flight request fails", async () => {
  const result = item();
  enqueueCompletion(result);
  let fail!: (error: Error) => void;
  vi.mocked(progressApi.complete).mockReturnValueOnce(
    new Promise((_resolve, reject) => {
      fail = reject;
    }),
  );
  const sending = sendCompletion(result);
  localStorage.removeItem(`nexus-result-v1:${result.sessionId}`);
  fail(new Error("connection lost"));
  await expect(sending).rejects.toThrow("connection lost");
  expect(pendingResults()).toHaveLength(0);
  expect(
    localStorage.getItem(`nexus-result-v1:${result.sessionId}`),
  ).toBeNull();
});
it("retains cached results if storage becomes unreadable and keeps corrupt entries exportable", () => {
  const result = item();
  enqueueCompletion(result);
  const read = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new DOMException("Unavailable");
  });
  expect(pendingResults()).toContainEqual(
    expect.objectContaining({ sessionId: result.sessionId }),
  );
  read.mockRestore();
  localStorage.setItem(`nexus-result-v1:${result.sessionId}`, "broken json");
  expect(pendingResults()).toHaveLength(0);
  expect(localStorage.getItem(`nexus-result-v1:${result.sessionId}`)).toBe(
    "broken json",
  );
});
