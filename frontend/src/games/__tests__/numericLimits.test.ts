import { expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCheckpoint } from "../../features/session/hooks/useCheckpoint";
import { progressApi } from "../../api/client";
import { parseState as parseTetris } from "../tetris/codec";
import type { GameEngine } from "../../sdk/GameEngine";
import { TetrisGame } from "../tetris/Tetris";
import { AsteroidsGame } from "../asteroids/Asteroids";
import { PrismRun } from "../prism-rush/PrismRun";
import { Merge2048Game } from "../merge-2048/Merge2048";
import { limits } from "../../contracts/gameplay";
import { enqueueCompletion, pendingResults } from "../../shared/persistence/sessionQueue";
import { validateSave } from "../../shared/persistence/saves";
import type { InputState } from "../../sdk/GameSDK";
const canvas = { width: 960, height: 640 } as HTMLCanvasElement;
const config = { slug: "test", title: "Test", seed: 123 };
const idle: InputState = {
  up: false,
  down: false,
  left: false,
  right: false,
  action: false,
  cancel: false,
  pause: false,
  keys: {},
};

it("retains the last recovery when an invalid runtime snapshot cannot be saved", () => {
  vi.spyOn(progressApi, "saveRecovery").mockResolvedValue({ saved: true });
  const game = new TetrisGame();
  game.init(canvas, config);
  let state = game.getState();
  const engine = {
    canSave: true,
    getState: () => parseTetris(state),
    getScore: () => 0,
  } as unknown as GameEngine;
  const onRecovery = vi.fn();
  const { result, unmount } = renderHook(() =>
    useCheckpoint({
      slug: "tetris",
      engine: { current: engine },
      mounted: { current: true },
      options: {
        current: {
          mode: "marathon",
          rules_version: 2,
          config: {},
          difficulty: "normal",
        },
      },
      session: {
        current: {
          id: crypto.randomUUID(),
          profileId: 7,
          difficulty: "normal",
          confirmed: true,
          seconds: 0,
          since: null,
          mode: "marathon",
          rulesVersion: 2,
        },
      },
      onRecovery,
      notify: vi.fn(),
    }),
  );
  act(() => result.current.checkpoint());
  expect(onRecovery).toHaveBeenCalledOnce();
  const validRecovery = onRecovery.mock.calls[0][0];
  state = { ...state, score: limits.score + 1 };
  act(() => result.current.checkpoint());
  expect(onRecovery).toHaveBeenCalledOnce();
  expect(validRecovery.state.score).toBe(0);
  unmount();
});

it("rejects out-of-contract saved scores before applying them", async () => {
  const games = [new TetrisGame(), new AsteroidsGame()];
  for (const game of games) {
    game.init(canvas, config);
    const previous = game.getState();
    expect(() =>
      game.setState({ ...previous, score: limits.score + 1 }),
    ).toThrow();
    expect(game.getState()).toEqual(previous);
  }
  const prism = new PrismRun(123),
    previous = prism.getState();
  expect(() =>
    prism.setState({ ...previous, score: limits.score + 1 }),
  ).toThrow();
  expect(prism.getState()).toEqual(previous);
  const tetris = games[0];
  await expect(
    validateSave(
      {
        format: 2,
        game: "tetris",
        difficulty: "normal",
        mode: "marathon",
        rules_version: 2,
        state: { ...tetris.getState(), score: limits.score + 1 },
      },
      "tetris",
    ),
  ).rejects.toThrow();
});
it("ends 2048 at its declared tile ceiling and keeps undo/restoration valid", () => {
  const game = new Merge2048Game();
  game.init(canvas, config);
  game.setState({
    ...game.getState(),
    board: [
      limits.highest_tile / 2,
      limits.highest_tile / 2,
      ...Array(14).fill(0),
    ],
  });
  expect(game.update(16, { ...idle, left: true })).toBe(false);
  expect(game.getMetrics()).toEqual({
    highest_tile: limits.highest_tile,
    completed: true,
  });
  expect(game.getResult().title).toBe("Maximum tile reached");
  const copy = new Merge2048Game();
  copy.init(canvas, config);
  copy.setState(game.getState());
  expect(copy.update(16, idle)).toBe(false);
  game.recover();
  expect(game.update(16, idle)).toBe(true);
  expect(Math.max(...(game.getState().board as number[]))).toBe(
    limits.highest_tile / 2,
  );
});
it("reports an unrecordable result without writing a malformed retry entry", () => {
  const identity = crypto.randomUUID();
  expect(() =>
    enqueueCompletion({
      slug: "tetris",
      sessionId: identity,
      profileId: 7,
      seconds: 10,
      score: limits.score + 1,
      difficulty: "normal",
      metrics: {},
    }),
  ).toThrow(/cannot be recorded/);
  expect(pendingResults().some((result) => result.sessionId === identity)).toBe(
    false,
  );
});
it("detects score overflow visibly while retaining the last valid score", () => {
  const game = new TetrisGame();
  game.init(canvas, config);
  game.setState({ ...game.getState(), score: limits.score });
  expect(() => game.update(16, { ...idle, action: true })).toThrow(
    /score limit/,
  );
  expect(game.getScore()).toBe(limits.score);
});
