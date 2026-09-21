import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { watchVisibleTask } from "../background";
import { progressApi } from "../../../api/client";
import {
  enqueueCompletion,
  flushCompletions,
  pendingResults,
  startCompletionSync,
} from "../../persistence/sessionQueue";

let visibility = "visible";
let stop = () => {};
beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  pendingResults();
  visibility = "visible";
  vi.spyOn(document, "visibilityState", "get").mockImplementation(
    () => visibility as DocumentVisibilityState,
  );
  vi.spyOn(progressApi, "complete").mockResolvedValue({
    high_score: 10,
    is_new_high_score: false,
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
afterEach(() => {
  stop();
  stop = () => {};
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const item = () => ({
  slug: "snake",
  sessionId: crypto.randomUUID(),
  profileId: 7,
  seconds: 5,
  score: 10,
  difficulty: "normal" as const,
  metrics: {},
});
const changeVisibility = (value: string) => {
  visibility = value;
  document.dispatchEvent(new Event("visibilitychange"));
};

it("does not schedule idle or permanently blocked result retries", async () => {
  stop = startCompletionSync();
  expect(vi.getTimerCount()).toBe(0);
  enqueueCompletion({ ...item(), blocked: true });
  expect(vi.getTimerCount()).toBe(0);
  await vi.advanceTimersByTimeAsync(300000);
  expect(progressApi.complete).not.toHaveBeenCalled();
});
it("wakes for a new result, respects failure backoff and stops after success", async () => {
  stop = startCompletionSync();
  vi.mocked(progressApi.complete).mockRejectedValueOnce(new Error("offline"));
  enqueueCompletion(item());
  await vi.advanceTimersByTimeAsync(0);
  expect(progressApi.complete).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1999);
  expect(progressApi.complete).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1);
  expect(progressApi.complete).toHaveBeenCalledTimes(2);
  expect(pendingResults()).toHaveLength(0);
  expect(vi.getTimerCount()).toBe(0);
});
it("suspends pending work in hidden tabs and retries when visible", async () => {
  changeVisibility("hidden");
  enqueueCompletion(item());
  stop = startCompletionSync();
  expect(vi.getTimerCount()).toBe(0);
  await vi.advanceTimersByTimeAsync(60000);
  expect(progressApi.complete).not.toHaveBeenCalled();
  changeVisibility("visible");
  await vi.advanceTimersByTimeAsync(0);
  expect(progressApi.complete).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
});
it("cancels visible polling on hide and teardown without overlapping requests", async () => {
  const signals: AbortSignal[] = [];
  stop = watchVisibleTask(
    (signal) => {
      signals.push(signal);
      return new Promise<void>((resolve) =>
        signal.addEventListener("abort", () => resolve()),
      );
    },
    () => 100,
  );
  await vi.advanceTimersByTimeAsync(100);
  window.dispatchEvent(new Event("online"));
  await vi.advanceTimersByTimeAsync(5000);
  expect(signals).toHaveLength(1);
  changeVisibility("hidden");
  await vi.advanceTimersByTimeAsync(0);
  expect(signals[0].aborted).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
  changeVisibility("visible");
  await vi.advanceTimersByTimeAsync(0);
  expect(signals).toHaveLength(2);
  stop();
  await vi.advanceTimersByTimeAsync(0);
  expect(signals[1].aborted).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});
it("reloads the queue inside the shared browser lock so concurrent flushes send once", async () => {
  let tail = Promise.resolve();
  const request = vi.fn(
    (_name: string, _options: unknown, callback: () => Promise<void>) => {
      const next = tail.then(callback);
      tail = next;
      return next;
    },
  );
  vi.stubGlobal("navigator", { locks: { request } });
  enqueueCompletion(item());
  await Promise.all([flushCompletions(), flushCompletions()]);
  expect(request).toHaveBeenCalledTimes(2);
  expect(progressApi.complete).toHaveBeenCalledTimes(1);
});
it("shares connection checks and still checks loopback without an Internet connection", async () => {
  vi.resetModules();
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
  const fetch = vi.fn().mockResolvedValue({ ok: true });
  vi.stubGlobal("fetch", fetch);
  const { subscribeConnection, connectionSnapshot } =
    await import("../connection");
  const first = subscribeConnection(vi.fn());
  const second = subscribeConnection(vi.fn());
  stop = () => {
    first();
    second();
  };
  await vi.advanceTimersByTimeAsync(0);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(connectionSnapshot().status).toBe("online");
  changeVisibility("hidden");
  await vi.advanceTimersByTimeAsync(90000);
  expect(fetch).toHaveBeenCalledTimes(1);
  changeVisibility("visible");
  await vi.advanceTimersByTimeAsync(0);
  expect(fetch).toHaveBeenCalledTimes(2);
  stop();
  expect(vi.getTimerCount()).toBe(0);
});
