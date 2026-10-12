import { describe, it, expect, vi } from "vitest";
import * as THREE from "three";
import { SnakeGame } from "../games/snake/Snake";
import { RaptorRunGame } from "../games/raptor-run/RaptorRun";
import { BreakoutGame } from "../games/breakout/Breakout";
import { Merge2048Game, moveBoard } from "../games/merge-2048/Merge2048";
import { FlightController } from "../games/stellar-flight/FlightController";
import {
  crossGate,
  terrainHeight,
  TERRAIN_STEP,
} from "../games/stellar-flight/course";
import type { InputState } from "../sdk/GameSDK";
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
const canvas = () =>
  ({
    width: 960,
    height: 640,
    getContext: () => ({}),
  }) as unknown as HTMLCanvasElement;
const config = { slug: "test", title: "test", difficulty: "normal" as const };
describe("complete saves", () => {
  it.each([
    ["Snake", SnakeGame],
    ["Raptor", RaptorRunGame],
    ["Breakout", BreakoutGame],
    ["2048", Merge2048Game],
  ] as const)(
    "%s restores simulation state and isolates snapshots",
    (_name, Game) => {
      const original = new Game();
      original.init(canvas(), config);
      original.update(200, { ...idle, action: true, left: true });
      const saved = original.getState();
      const restored = new Game();
      restored.init(canvas(), config);
      restored.setState(saved);
      expect(restored.getState()).toEqual(saved);
      original.update(100, idle);
      expect(restored.getState()).toEqual(saved);
    },
  );
  it.each([SnakeGame, RaptorRunGame, BreakoutGame, Merge2048Game])(
    "rejects incomplete or old saves instead of pretending to restore",
    (Game) => {
      const game = new Game();
      game.init(canvas(), config);
      expect(() => game.setState({ score: 10 })).toThrow();
    },
  );
});
it("Snake permits moving into the vacated tail", () => {
  const game = new SnakeGame();
  game.init(canvas(), config);
  game.setState({
    ...game.getState(),
    cols: 6,
    rows: 6,
    snake: [
      { x: 2, y: 2 },
      { x: 2, y: 3 },
      { x: 1, y: 3 },
      { x: 1, y: 2 },
    ],
    food: { x: 5, y: 5 },
    direction: "left",
    nextDirection: "left",
    lastTail: null,
  });
  expect(game.update(120, idle)).toBe(true);
});
it("Snake finishes a full board without trying forever to spawn food", () => {
  const game = new SnakeGame();
  game.init(canvas(), config);
  const occupied = Array.from({ length: 36 }, (_, i) => ({
    x: i % 6,
    y: Math.floor(i / 6),
  })).filter((p) => !(p.x === 5 && p.y === 5));
  const head = occupied.splice(
    occupied.findIndex((p) => p.x === 4 && p.y === 5),
    1,
  )[0];
  game.setState({
    ...game.getState(),
    cols: 6,
    rows: 6,
    snake: [head, ...occupied],
    food: { x: 5, y: 5 },
    direction: "right",
    nextDirection: "right",
    lastTail: null,
  });
  expect(game.update(120, idle)).toBe(false);
  expect(game.getScore()).toBe(10);
});
it("Raptor keeps difficulty modifiers and records real jumps", () => {
  const easy = new RaptorRunGame(),
    hard = new RaptorRunGame();
  easy.init(canvas(), { ...config, difficulty: "easy" });
  hard.init(canvas(), { ...config, difficulty: "hard" });
  easy.update(16, idle);
  hard.update(16, idle);
  expect(Number(hard.getState().gameSpeed)).toBeGreaterThan(
    Number(easy.getState().gameSpeed),
  );
  expect(easy.getMetrics().jumps).toBe(0);
  easy.update(16, { ...idle, action: true });
  expect(easy.getMetrics().jumps).toBe(1);
});
it.each([
  [[2, 2, 2, 2], [4, 4, 0, 0], 8],
  [[2, 2, 4, 0], [4, 4, 0, 0], 4],
  [[0, 2, 0, 2], [4, 0, 0, 0], 4],
  [[4, 0, 8, 0], [4, 8, 0, 0], 0],
])("2048 merges each tile only once", (input, output, score) => {
  const result = moveBoard(
    [...(input as number[]), ...Array(12).fill(0)],
    "left",
  );
  expect({ line: result.board.slice(0, 4), score: result.score }).toEqual({
    line: output,
    score,
  });
});
it("2048 spawns only after a changed move and does not repeat a held direction", () => {
  vi.spyOn(Math, "random").mockReturnValue(0);
  const game = new Merge2048Game();
  game.init(canvas());
  game.setState({
    version: 1,
    score: 0,
    board: [2, 0, 0, 0, ...Array(12).fill(0)],
  });
  game.update(16, { ...idle, left: true });
  expect((game.getState().board as number[]).filter(Boolean)).toHaveLength(1);
  game.update(16, idle);
  game.update(16, { ...idle, right: true });
  expect((game.getState().board as number[]).filter(Boolean)).toHaveLength(2);
  const saved = game.getState();
  game.update(16, { ...idle, right: true });
  expect(game.getState()).toEqual(saved);
});
it("flight can reach Mach 1 and up pitches the nose away from the ground", () => {
  const controller = new FlightController();
  controller.update(10, { ...idle, up: true, keys: { ShiftLeft: true } });
  expect(controller.speed).toBeGreaterThan(340);
  expect(controller.getDeltaRotation(1).x).toBeLessThan(0);
});
it("2048 accepts a different direction without waiting for a neutral frame", () => {
  vi.spyOn(Math, "random").mockReturnValue(0);
  const game = new Merge2048Game();
  game.init(canvas());
  game.setState({
    version: 1,
    score: 0,
    board: [2, 0, 0, 0, ...Array(12).fill(0)],
  });
  game.update(16, { ...idle, left: true });
  game.update(16, { ...idle, right: true });
  expect((game.getState().board as number[]).filter(Boolean)).toHaveLength(2);
});

it("2048 can undo one move after saving and restoring, without spawning another tile", () => {
  const game = new Merge2048Game();
  game.init(canvas());
  const before = [2, 2, 0, 0, ...Array(12).fill(0)];
  game.setState({ version: 1, score: 12, board: before });
  game.update(16, { ...idle, left: true });
  const saved = game.getState();
  const restored = new Merge2048Game();
  restored.init(canvas());
  restored.setState(saved);
  restored.update(16, { ...idle, keys: { KeyZ: true } });
  expect(restored.getState()).toMatchObject({
    score: 12,
    board: before,
    undo: null,
  });
  restored.update(16, idle);
  restored.update(16, { ...idle, keys: { KeyZ: true } });
  expect(restored.getState()).toMatchObject({
    score: 12,
    board: before,
    undo: null,
  });
});
it("2048's moving tiles correspond to one merge per pair", () => {
  const result = moveBoard([2, 2, 2, 2, ...Array(12).fill(0)], "right");
  expect(result.board.slice(0, 4)).toEqual([0, 0, 4, 4]);
  expect(result.score).toBe(8);
  expect(result.merged).toEqual([3, 2]);
  expect(result.motions.map((m) => m.from).sort()).toEqual([0, 1, 2, 3]);
});
it("Snake buffers two quick turns and makes them on separate grid steps", () => {
  const game = new SnakeGame();
  game.init(canvas(), config);
  game.setState({
    ...game.getState(),
    snake: [
      { x: 8, y: 8 },
      { x: 7, y: 8 },
      { x: 6, y: 8 },
    ],
    food: { x: 20, y: 10 },
    direction: "right",
    nextDirection: "right",
    moveTimer: 0,
  });
  game.update(10, { ...idle, up: true });
  game.update(10, { ...idle, left: true });
  const saved = game.getState();
  expect(saved.turns).toEqual(["up", "left"]);
  const restored = new SnakeGame();
  restored.init(canvas(), config);
  restored.setState(saved);
  restored.update(100, idle);
  expect(restored.getState().snake).toContainEqual({ x: 8, y: 7 });
  restored.update(120, idle);
  expect((restored.getState().snake as { x: number; y: number }[])[0]).toEqual({
    x: 7,
    y: 7,
  });
});
it("Raptor does not jump again when the action button remains held after landing", () => {
  const game = new RaptorRunGame();
  game.init(canvas(), config);
  for (let i = 0; i < 55; i++) game.update(16, { ...idle, action: true });
  expect(game.getMetrics().jumps).toBe(1);
  game.update(16, idle);
  game.update(16, { ...idle, action: true });
  expect(game.getMetrics().jumps).toBe(2);
});
it("Raptor buffers a jump pressed just before landing", () => {
  const game = new RaptorRunGame();
  game.init(canvas(), config);
  game.setState({
    ...game.getState(),
    isJumping: true,
    raptorY: 449,
    raptorVelocity: 200,
  });
  game.update(16, { ...idle, action: true });
  game.update(16, { ...idle, action: true });
  expect(game.getMetrics().jumps).toBe(1);
  expect(game.getState().isJumping).toBe(true);
});
it("Breakout advances through distinct sectors and finishes the final one", () => {
  const game = new BreakoutGame();
  game.init(canvas(), config);
  game.setState({
    ...game.getState(),
    bricks: Array(60).fill(false),
    score: 600,
  });
  expect(game.update(16, idle)).toBe(true);
  expect(game.getState()).toMatchObject({
    stage: 2,
    launched: false,
    lives: 3,
  });
  expect(
    (game.getState().bricks as boolean[]).filter(Boolean).length,
  ).toBeLessThan(60);
  game.setState({ ...game.getState(), bricks: Array(60).fill(false) });
  expect(game.update(16, idle)).toBe(true);
  expect(game.getState().stage).toBe(3);
  game.setState({ ...game.getState(), bricks: Array(60).fill(false) });
  expect(game.update(16, idle)).toBe(false);
  expect(game.getResult().title).toBe("All sectors cleared");
});
it.each([SnakeGame, RaptorRunGame, BreakoutGame, Merge2048Game])(
  "accepts existing full saves without newly introduced fields",
  (Game) => {
    const game = new Game();
    game.init(canvas(), config);
    const old = game.getState();
    for (const field of ["turns", "jumpBuffer", "stage", "undo"])
      delete old[field];
    expect(() => game.setState(old)).not.toThrow();
  },
);
it("flight counts a gate crossed between frames and distinguishes a near miss", () => {
  expect(crossGate([0, 0, -100], [0, 0, 100], [0, 0, 0], [0, 0, 1])).toBe(
    "pass",
  );
  expect(crossGate([26, 0, -100], [26, 0, 100], [0, 0, 0], [0, 0, 1])).toBe(
    "miss",
  );
  expect(crossGate([0, 0, 100], [0, 0, -100], [0, 0, 0], [0, 0, 1])).toBeNull();
});
it("flight banks turn the heading in opposite directions and require airspeed", () => {
  const controller = new FlightController();
  expect(controller.getBankTurn(1, Math.PI / 4)).toBe(0);
  controller.speed = 100;
  expect(controller.getBankTurn(1, Math.PI / 4)).toBeGreaterThan(0);
  expect(controller.getBankTurn(1, -Math.PI / 4)).toBeLessThan(0);
});
it("flight terrain is continuous at mesh seams and differs between planets", () => {
  for (const map of [0, 1])
    expect(
      Math.abs(
        terrainHeight(TERRAIN_STEP - 0.001, 30, map) -
          terrainHeight(TERRAIN_STEP + 0.001, 30, map),
      ),
    ).toBeLessThan(0.01);
  expect(terrainHeight(500, 500, 0)).not.toBe(terrainHeight(500, 500, 1));
  for (const x of [-10000, 0, 10000])
    expect(terrainHeight(x, x, 0)).toBeGreaterThan(-190);
});
it("flight ground contact matches raycasts against the actual rendered terrain triangles", () => {
  for (const map of [0, 1])
    for (const [cx, cz] of [
      [0, 0],
      [TERRAIN_STEP * 4, -TERRAIN_STEP * 3],
    ]) {
      const geometry = new THREE.PlaneGeometry(10000, 10000, 64, 64),
        positions = geometry.attributes.position;
      const material = new THREE.MeshBasicMaterial(),
        mesh = new THREE.Mesh(geometry, material);
      try {
        for (let i = 0; i < positions.count; i++)
          positions.setZ(
            i,
            terrainHeight(
              positions.getX(i) + cx,
              -positions.getY(i) + cz,
              map,
            ) + 50,
          );
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(cx, -50, cz);
        mesh.updateMatrixWorld(true);
        for (const [x, z] of [
          [13, 78],
          [-234, 712],
          [400, -300],
          [0, 0],
          [1234, 876],
          [4500, -4200],
        ]) {
          const ray = new THREE.Raycaster(
            new THREE.Vector3(x, 1000, z),
            new THREE.Vector3(0, -1, 0),
          );
          const hit = ray.intersectObject(mesh)[0];
          expect(hit).toBeDefined();
          expect(Math.abs(hit.point.y - terrainHeight(x, z, map))).toBeLessThan(
            0.001,
          );
        }
      } finally {
        geometry.dispose();
        material.dispose();
      }
    }
});
it.each([SnakeGame, RaptorRunGame, BreakoutGame, Merge2048Game])(
  "restoring RNG state preserves the future simulation",
  (Game) => {
    const original = new Game(),
      restored = new Game();
    original.init(canvas(), { ...config, seed: 123, mode: "classic" });
    restored.init(canvas(), { ...config, seed: 999, mode: "classic" });
    restored.setState(original.getState());
    for (let i = 0; i < 90; i++) {
      const input = {
        ...idle,
        up: i % 20 < 10,
        right: i % 20 >= 10,
        action: i % 30 === 0,
      };
      expect(restored.update(16, input)).toBe(original.update(16, input));
      expect(restored.getState()).toEqual(original.getState());
    }
  },
);
it("terminal 2048 allows undo in relaxed mode but not challenge mode", () => {
  const board = [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2, 4, 8, 16, 32, 64];
  for (const mode of ["classic", "challenge"]) {
    const game = new Merge2048Game();
    game.init(canvas(), { ...config, mode });
    game.setState({
      version: 1,
      score: 100,
      board,
      mode,
      undo: { board: [2, 2, 0, 0, ...Array(12).fill(0)], score: 0 },
    });
    expect(game.update(16, idle)).toBe(false);
    expect(game.getStatus()).toBe(
      mode === "classic" ? "recoverable" : "complete",
    );
    if (mode === "classic") {
      game.recover();
      expect(game.update(16, idle)).toBe(true);
      expect(game.getScore()).toBe(0);
    }
  }
});
it("Snake consumes two ordered taps in one simulation step", () => {
  const game = new SnakeGame();
  game.init(canvas(), config);
  game.update(1, {
    ...idle,
    pressed: ["ArrowUp", "ArrowLeft"],
    up: true,
    left: true,
  });
  expect(game.getState().turns).toEqual(["up", "left"]);
});
it("Snake sprint finishes at sixty seconds and maze walls are validated", () => {
  const game = new SnakeGame();
  game.init(canvas(), { ...config, mode: "sprint" });
  expect(game.update(60000, idle)).toBe(false);
  expect(game.getResult().title).toBe("Sprint complete");
  game.init(canvas(), { ...config, mode: "maze" });
  expect((game.getState().walls as unknown[]).length).toBeGreaterThan(0);
  expect(() =>
    game.setState({ ...game.getState(), walls: [{ x: 999, y: 999 }] }),
  ).toThrow();
});
it("Breakout armored bricks take two hits and explosive bricks clear neighbors", () => {
  const game = new BreakoutGame();
  game.init(canvas(), config);
  const state = game.getState();
  game.setState({
    ...state,
    stage: 2,
    launched: true,
    ball: { x: 80, y: 106, vx: 0, vy: 0 },
    armor: Array(60).fill(2),
  });
  game.update(1, idle);
  expect((game.getState().bricks as boolean[])[0]).toBe(true);
  expect(game.getScore()).toBe(5);
  game.update(1, idle);
  expect((game.getState().bricks as boolean[])[0]).toBe(false);
  expect(game.getScore()).toBe(15);
  game.setState({
    ...state,
    stage: 3,
    launched: true,
    ball: { x: 80, y: 106, vx: 0, vy: 0 },
  });
  game.update(1, idle);
  expect((game.getState().bricks as boolean[]).slice(0, 2)).toEqual([
    false,
    false,
  ]);
});
