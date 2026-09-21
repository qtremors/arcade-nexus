import { describe, expect, it } from "vitest";
import { TetrisGame } from "../tetris/Tetris";
import { AsteroidsGame } from "../asteroids/Asteroids";
import { PrismRun } from "../prism-rush/PrismRun";
import { getDescriptor, gameSlugs } from "../descriptors";
import type { InputState } from "../../sdk/GameSDK";
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
const canvas = { width: 960, height: 640 } as HTMLCanvasElement;
const config = { slug: "test", title: "test", seed: 12345 };
function tetris() {
  const game = new TetrisGame();
  game.init(canvas, config);
  return game;
}
function asteroids() {
  const game = new AsteroidsGame();
  game.init(canvas, config);
  return game;
}

describe("Tetris", () => {
  it("starts with a fair seven-piece bag", () => {
    const state = tetris().getState();
    expect(
      new Set([state.piece, ...(state.queue as number[]).slice(0, 6)]).size,
    ).toBe(7);
  });
  it("hard drops, clears four rows, and completes a 40-line sprint", () => {
    const game = tetris();
    const board = Array.from({ length: 20 }, (_, y) =>
      Array.from({ length: 10 }, (_, x) => (y >= 16 && x !== 5 ? 2 : 0)),
    );
    game.setState({
      ...game.getState(),
      board,
      piece: 0,
      rotation: 1,
      x: 3,
      y: 0,
      lines: 36,
      mode: "sprint",
    });
    expect(game.update(16, { ...idle, action: true })).toBe(false);
    expect(game.getState().lines).toBe(40);
    expect(game.getMetrics().completed).toBe(true);
    expect(game.getScore()).toBeGreaterThanOrEqual(3200);
    expect(
      (game.getState().board as number[][]).flat().every((v) => v === 0),
    ).toBe(true);
  });
  it("holds at most once per piece and does not repeat a held hard drop", () => {
    const game = tetris(),
      before = game.getState().piece;
    game.update(16, { ...idle, keys: { KeyV: true } });
    expect(game.getState().held).toBe(before);
    const next = game.getState().piece;
    game.update(16, idle);
    game.update(16, { ...idle, keys: { KeyV: true } });
    expect(game.getState().piece).toBe(next);
    game.update(16, { ...idle, action: true });
    const board = game.getState().board;
    game.update(16, { ...idle, action: true });
    expect(game.getState().board).toEqual(board);
    expect(game.getState().canHold).toBe(true);
  });
  it("allows a wall kick but never moves a piece through the board", () => {
    const game = tetris();
    game.setState({ ...game.getState(), piece: 0, rotation: 1, x: -2, y: 5 });
    game.update(16, { ...idle, up: true });
    expect(game.getState().rotation).toBe(2);
    expect(Number(game.getState().x)).toBeGreaterThanOrEqual(0);
  });
  it("locks after its delay and tops out on a blocked spawn", () => {
    const game = tetris();
    const board = Array.from({ length: 20 }, () => Array<number>(10).fill(0));
    board[0][3] = 2;
    board[0][4] = 2;
    game.setState({
      ...game.getState(),
      board,
      piece: 1,
      x: 0,
      y: 18,
      queue: [1, 2, 3, 4, 5, 6, 0],
    });
    expect(game.update(400, idle)).toBe(true);
    expect(game.update(60, idle)).toBe(false);
  });
});
describe("Asteroids", () => {
  it("splits a hit rock and awards points", () => {
    const game = asteroids();
    game.setState({
      ...game.getState(),
      rocks: [{ x: 100, y: 100, vx: 0, vy: 0, size: 3, angle: 0 }],
      bullets: [{ x: 100, y: 100, vx: 0, vy: 0, life: 1 }],
    });
    game.update(16, idle);
    expect(game.getScore()).toBe(20);
    expect(
      (game.getState().rocks as { size: number }[]).map((r) => r.size),
    ).toEqual([2, 2]);
  });
  it("collides across wrapped edges and grants one recovery shield", () => {
    const game = asteroids();
    game.setState({
      ...game.getState(),
      ship: { x: 2, y: 200, vx: 0, vy: 0, angle: 0 },
      rocks: [{ x: 958, y: 200, vx: 0, vy: 0, size: 1, angle: 0 }],
      invulnerable: 0,
    });
    game.update(16, idle);
    expect(game.getState().lives).toBe(2);
    game.update(16, idle);
    expect(game.getState().lives).toBe(2);
  });
  it("advances cleared waves and ends after the final hull", () => {
    const game = asteroids();
    game.setState({ ...game.getState(), rocks: [], intermission: 0 });
    game.update(16, idle);
    expect(game.getState().wave).toBe(2);
    expect((game.getState().rocks as unknown[]).length).toBe(5);
    game.setState({
      ...game.getState(),
      lives: 1,
      invulnerable: 0,
      rocks: [{ x: 480, y: 320, vx: 0, vy: 0, size: 1, angle: 0 }],
    });
    expect(game.update(16, idle)).toBe(false);
  });
});
describe("Prism Rush", () => {
  it("changes only one lane per press and permits a fresh press", () => {
    const game = new PrismRun(1);
    game.update(16, { ...idle, left: true });
    game.update(16, { ...idle, left: true });
    expect(game.lane).toBe(0);
    game.update(16, { ...idle, right: true });
    expect(game.lane).toBe(1);
    game.update(16, idle);
    game.update(16, { ...idle, right: true });
    expect(game.lane).toBe(2);
  });
  it("collects only in the opening and counts each impact once", () => {
    const game = new PrismRun(1);
    game.rows = [{ id: 0, z: -1.2, safe: 1, passed: false }];
    game.nextId = 1;
    expect(game.update(16, idle)).toBe("collect");
    expect(game.crystals).toBe(1);
    game.update(16, idle);
    expect(game.crystals).toBe(1);
    game.rows = [{ id: 1, z: -1.2, safe: 0, passed: false }];
    game.nextId = 2;
    expect(game.update(16, idle)).toBe("hit");
    expect(game.lives).toBe(2);
    game.update(16, idle);
    expect(game.lives).toBe(2);
  });
  it("generates passable gates and keeps a bounded visible world during long play", () => {
    const game = new PrismRun(19, "hard");
    for (let step = 0; step < 18000; step++) {
      const next = game.rows.find((r) => !r.passed);
      const direction = next ? Math.sign(next.safe - game.lane) : 0;
      game.update(1000 / 60, {
        ...idle,
        left: step % 2 === 0 && direction < 0,
        right: step % 2 === 0 && direction > 0,
      });
      expect(game.rows.length).toBeLessThanOrEqual(12);
    }
    expect(game.lives).toBe(3);
    expect(game.crystals).toBeGreaterThan(100);
  });
});
it.each(["Tetris", "Asteroids", "Prism Rush"])(
  "%s continues identically after restoring RNG and simulation state",
  (name) => {
    const create =
      name === "Tetris"
        ? tetris
        : name === "Asteroids"
          ? asteroids
          : () => new PrismRun(12345);
    const original = create();
    for (let i = 0; i < 90; i++) original.update(16, idle);
    const snapshot = original.getState(),
      restored = create();
    restored.setState(snapshot);
    expect(restored.getState()).toEqual(snapshot);
    for (let i = 0; i < 50; i++) {
      original.update(16, idle);
      restored.update(16, idle);
    }
    expect(restored.getState()).toEqual(original.getState());
    expect(() => restored.setState({ version: 1, score: 10 })).toThrow();
    restored.update(16, idle);
    expect(snapshot).not.toEqual(restored.getState());
  },
);
it("registers all eight games with loadable modules", async () => {
  expect(gameSlugs).toHaveLength(8);
  for (const slug of ["tetris", "asteroids", "prism-rush"]) {
    const descriptor = getDescriptor(slug);
    const game = await descriptor.load();
    expect(game.type).toBe(slug === "prism-rush" ? "3d" : "2d");
    expect(descriptor.experience.controls.length).toBeGreaterThan(0);
  }
});
