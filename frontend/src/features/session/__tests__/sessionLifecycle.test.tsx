import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { GameInstance } from "../../../sdk/GameSDK";
import type { GameEngine } from "../../../sdk/GameEngine";
import type { ActiveRun } from "../services/activeRun";
import type { RunOptions } from "../hooks/useCheckpoint";
import { useSessionRuntime } from "../hooks/useSessionRuntime";
import { useRunCompletion } from "../hooks/useRunCompletion";
import {
  enqueueCompletion,
  sendCompletion,
  sendCompletionOnExit,
} from "../../../shared/persistence/sessionQueue";
import type { CompletionReceipt } from "../../../api/client";
const mocks = vi.hoisted(() => ({ load: vi.fn(), create: vi.fn() }));
vi.mock("../../../games", () => ({ loadGame: mocks.load }));
vi.mock("../../../shared/runtime/gameRuntime", () => ({ createGameEngine: mocks.create }));
vi.mock("../../../shared/persistence/sessionQueue", () => ({
  enqueueCompletion: vi.fn(() => true),
  sendCompletion: vi.fn(),
  sendCompletionOnExit: vi.fn(),
}));
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function engine() {
  const callbacks = {
    pause: () => {},
    over: (score: number) => {
      void score;
    },
    error: (error: Error) => {
      void error;
    },
  };
  return {
    callbacks,
    destroy: vi.fn(),
    init: vi.fn(async () => {}),
    setState: vi.fn(),
    stop: vi.fn(),
    pause: vi.fn(),
    onPause: (fn: () => void) => {
      callbacks.pause = fn;
    },
    onGameOver: (fn: (score: number) => void) => {
      callbacks.over = fn;
    },
    onError: (fn: (error: Error) => void) => {
      callbacks.error = fn;
    },
  };
}
function ports() {
  return {
    slug: "snake",
    title: "Snake",
    optionsRef: {
      current: {
        mode: "classic",
        rules_version: 3,
        config: {},
        difficulty: "normal",
      } as RunOptions,
    },
    canvasRef: { current: document.createElement("canvas") },
    engineRef: { current: null as GameEngine | null },
    sessionRef: { current: null as ActiveRun | null },
    profileIdRef: { current: 7 },
    mountedRef: { current: false },
    state: "loading" as const,
    setState: vi.fn(),
    setError: vi.fn(),
    setScore: vi.fn(),
    setRecovery: vi.fn(),
    syncRuntimeView: vi.fn(),
    stopClock: vi.fn(),
    checkpoint: vi.fn(),
    finish: vi.fn(async () => {}),
    flushOnExit: vi.fn(),
    showToast: vi.fn(),
  };
}
beforeEach(() => {
  mocks.load.mockReset();
  mocks.create.mockReset();
});
it("disposes a game arriving after unmount without allocating an engine", async () => {
  const loaded = deferred<GameInstance>();
  mocks.load.mockReturnValue(loaded.promise);
  const args = ports(),
    instance = { destroy: vi.fn() } as unknown as GameInstance;
  const { unmount } = renderHook(() => useSessionRuntime(args));
  await waitFor(() => expect(mocks.load).toHaveBeenCalledOnce());
  unmount();
  await act(async () => {
    loaded.resolve(instance);
  });
  expect(instance.destroy).toHaveBeenCalledOnce();
  expect(mocks.create).not.toHaveBeenCalled();
});
it("disposes failed initialization and leaves no live engine reference", async () => {
  const failed = engine();
  failed.init.mockRejectedValue(new Error("Renderer unavailable"));
  mocks.load.mockResolvedValue({ destroy: vi.fn() });
  mocks.create.mockReturnValue(failed);
  const args = ports(),
    { unmount } = renderHook(() => useSessionRuntime(args));
  await waitFor(() => expect(args.setState).toHaveBeenCalledWith("error"));
  expect(failed.destroy).toHaveBeenCalledOnce();
  expect(args.engineRef.current).toBeNull();
  expect(args.setScore).not.toHaveBeenCalled();
  unmount();
  expect(failed.destroy).toHaveBeenCalledOnce();
});
it("ignores callbacks from a replaced engine generation", async () => {
  const first = engine(),
    second = engine();
  mocks.load.mockResolvedValue({ destroy: vi.fn() });
  mocks.create.mockReturnValueOnce(first).mockReturnValueOnce(second);
  const args = ports(),
    { result, unmount } = renderHook(() => useSessionRuntime(args));
  await waitFor(() => expect(args.setState).toHaveBeenCalledWith("ready"));
  await act(async () => {
    await result.current.prepare("hard");
  });
  args.setState.mockClear();
  args.stopClock.mockClear();
  args.finish.mockClear();
  act(() => {
    first.callbacks.pause();
    first.callbacks.over(99);
    first.callbacks.error(new Error("old"));
  });
  expect(args.setState).not.toHaveBeenCalled();
  expect(args.stopClock).not.toHaveBeenCalled();
  expect(args.finish).not.toHaveBeenCalled();
  act(() => second.callbacks.pause());
  expect(args.setState).toHaveBeenCalledWith("paused");
  unmount();
});
function run(): ActiveRun {
  return {
    id: crypto.randomUUID(),
    profileId: 7,
    difficulty: "normal",
    confirmed: true,
    seconds: 12,
    since: null,
    mode: "classic",
    rulesVersion: 3,
  };
}
it("keeps a late completion receipt out of a newer run and reuses the completed payload on exit", async () => {
  const pending = deferred<CompletionReceipt>();
  vi.mocked(sendCompletion).mockReturnValue(pending.promise);
  const session = { current: run() },
    old = session.current,
    applyReceipt = vi.fn();
  const { result, unmount } = renderHook(() =>
    useRunCompletion({
      slug: "snake",
      session,
      engine: {
        current: { getScore: () => 100, getMetrics: () => ({}) } as GameEngine,
      },
      mounted: { current: true },
      applyReceipt,
      showToast: vi.fn(),
    }),
  );
  let finished!: Promise<void>;
  act(() => {
    finished = result.current.finish();
  });
  const payload = vi.mocked(enqueueCompletion).mock.calls.at(-1)![0];
  act(() => result.current.flushOnExit());
  expect(sendCompletionOnExit).toHaveBeenLastCalledWith(payload);
  expect(payload.sessionId).toBe(old.id);
  expect(payload.seconds).toBe(12);
  session.current = run();
  await act(async () => {
    pending.resolve({
      session_id: old.id,
      high_score: 100,
      is_new_high_score: true,
      previous_high_score: 0,
      best_time_ms: null,
      previous_best_time_ms: null,
      is_new_best_time: false,
      awards: [],
      medal: null,
      total_playtime: 12,
    });
    await finished;
  });
  expect(applyReceipt).not.toHaveBeenCalled();
  unmount();
});
