import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { progressApi, statsApi, setApiProfileId } from "../api/client";
import { ToastContext } from "../hooks/useToast";
import { useGameSession } from "../hooks/useGameSession";

vi.mock("../games", () => ({ loadGame: async () => ({ destroy: vi.fn() }) }));
vi.mock("../sdk", () => ({
  GameEngine: class {
    canSave = true;
    recoverable = false;
    over?: (score: number) => void;
    init = async () => {};
    destroy = () => {};
    start = () => {};
    stop = () => {};
    getState = () => ({ score: 100 });
    getScore = () => 100;
    getMetrics = () => ({ ended: true });
    onPause = () => {};
    onError = () => {};
    onGameOver(callback: (score: number) => void) {
      this.over = callback;
    }
  },
}));
vi.mock("../services/recovery", () => ({
  storeRecovery: () => true,
  clearRecovery: vi.fn(),
  recoveries: async () => [],
}));
vi.mock("../services/sessionQueue", () => ({
  enqueueCompletion: () => true,
  sendCompletionOnExit: vi.fn(),
  sendCompletion: async () => ({
    high_score: 100,
    is_new_high_score: true,
    awards: [],
  }),
}));
const toast = { showToast: vi.fn() };
function Wrapper({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter>
      <ToastContext value={toast}>{children}</ToastContext>
    </MemoryRouter>
  );
}
it("keeps the new record receipt when an older records request finishes late", async () => {
  setApiProfileId(7);
  let resolve!: (
    records: Awaited<ReturnType<typeof progressApi.records>>,
  ) => void;
  vi.spyOn(progressApi, "records").mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  vi.spyOn(statsApi, "startSession").mockResolvedValue({
    session_id: crypto.randomUUID(),
    profile_id: 7,
  });
  const { result, unmount } = renderHook(
    () => useGameSession({ slug: "snake", title: "Snake" }),
    { wrapper: Wrapper },
  );
  Object.assign(result.current.canvas, {
    current: document.createElement("canvas"),
  });
  await waitFor(() => expect(result.current.state).toBe("ready"));
  await act(async () => {
    await result.current.start();
  });
  await act(async () => {
    const instance = result.current.engine.current as unknown as {
      over: (score: number) => void;
    };
    instance.over(100);
  });
  expect(result.current.highScore).toBe(100);
  expect(result.current.newHigh).toBe(true);
  await act(async () => {
    resolve([]);
  });
  expect(result.current.highScore).toBe(100);
  unmount();
  setApiProfileId(null);
});
