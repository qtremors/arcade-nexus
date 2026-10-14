import { describe, expect, it } from "vitest";
import { buildMaze } from "../games/snake/mazes";
import { SnakeGame } from "../games/snake/Snake";
import { RaptorRunGame } from "../games/raptor-run/RaptorRun";
import { PHRASES } from "../games/raptor-run/phrases";
import { BreakoutGame } from "../games/breakout/Breakout";
import { ARCADE_SECTORS } from "../games/breakout/sectors";
import { Merge2048Game, moveBoard } from "../games/merge-2048/Merge2048";
import { PUZZLES } from "../games/merge-2048/puzzles";
import { SpaceJourney } from "../games/stellar-flight/SpaceJourney";
import { PrismRun, RHYTHMS } from "../games/prism-rush/PrismRun";
import { completionSchema } from "../services/sessionQueue";
import { timeRanked, formatTime } from "../games/records";
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
const config = { slug: "test", title: "test", seed: 123 };

describe("authored mazes", () => {
  it.each([0, 1, 2, 3])(
    "layout %i has a clear starting corridor and fully reachable food",
    (layout) => {
      for (const [cols, rows] of [
        [14, 12],
        [24, 16],
        [36, 24],
      ]) {
        const walls = new Set(
          buildMaze(cols, rows, layout).map((p) => `${p.x},${p.y}`),
        );
        const seen = new Set<string>(),
          queue = [[Math.floor(cols / 2), Math.floor(rows / 2)]];
        for (let i = 0; i < queue.length; i++) {
          const [x, y] = queue[i],
            key = `${x},${y}`;
          if (
            x < 0 ||
            y < 0 ||
            x >= cols ||
            y >= rows ||
            walls.has(key) ||
            seen.has(key)
          )
            continue;
          seen.add(key);
          queue.push([x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]);
        }
        expect(seen.size + walls.size).toBe(cols * rows);
        for (let x = 0; x < cols; x++)
          expect(walls.has(`${x},${Math.floor(rows / 2)}`)).toBe(false);
      }
    },
  );
  it("bonus packets collect without growth, expire, and survive restoring", () => {
    const game = new SnakeGame();
    game.init(canvas(), { ...config, mode: "sprint-plus" });
    const state = game.getState(),
      snake = state.snake as { x: number; y: number }[];
    game.setState({
      ...state,
      bonus: { x: snake[0].x + 1, y: snake[0].y, expires: 4500 },
    });
    game.update(120, idle);
    expect(game.getScore()).toBe(30);
    expect(game.getState().bonuses).toBe(1);
    expect((game.getState().snake as unknown[]).length).toBe(snake.length);
    game.setState({ ...state, elapsed: 9999 });
    game.update(1, idle);
    const saved = game.getState();
    expect(saved.bonus).not.toBeNull();
    const restored = new SnakeGame();
    restored.init(canvas(), { ...config, mode: "sprint-plus" });
    restored.setState(saved);
    expect(restored.getState()).toEqual(saved);
    restored.setState({
      ...saved,
      elapsed: (saved.bonus as { expires: number }).expires - 1,
    });
    restored.update(1, idle);
    expect(restored.getState().bonus).toBeNull();
  });
});

it("every daily puzzle has a solution within its stated move limit", () => {
  for (const puzzle of PUZZLES) {
    const queue = [{ board: [...puzzle.board] as number[], moves: 0 }],
      seen = new Set<string>();
    let solved = false;
    for (let i = 0; i < queue.length; i++) {
      const { board, moves } = queue[i];
      if (Math.max(...board) >= puzzle.target) {
        solved = true;
        break;
      }
      if (moves >= puzzle.moves) continue;
      for (const direction of ["left", "right", "up", "down"] as const) {
        const next = moveBoard(board, direction).board,
          key = next.join();
        if (!seen.has(key)) {
          seen.add(key);
          queue.push({ board: next, moves: moves + 1 });
        }
      }
    }
    expect(solved, puzzle.name).toBe(true);
  }
});
it("undo replays the exact tile, including legacy and restored snapshots", () => {
  const game = new Merge2048Game();
  game.init(canvas(), config);
  game.setState({
    ...game.getState(),
    board: [2, 2, 0, 0, ...Array(12).fill(0)],
  });
  game.update(16, { ...idle, left: true });
  const after = game.getState();
  for (const legacy of [false, true]) {
    const restored = new Merge2048Game();
    restored.init(canvas(), config);
    const snapshot = structuredClone(after);
    if (legacy) delete (snapshot.undo as Record<string, unknown>).randomState;
    restored.setState(snapshot);
    restored.recover();
    restored.update(16, { ...idle, left: true });
    expect(restored.getState()).toEqual(after);
  }
});
it("daily moves do not spawn tiles, stop on a win, and have semantic buttons", () => {
  const parent = document.createElement("div"),
    element = document.createElement("canvas");
  parent.append(element);
  const game = new Merge2048Game();
  game.init(element, { ...config, seed: 0, mode: "daily" });
  expect(parent.querySelectorAll("td")).toHaveLength(16);
  const left = Array.from(parent.querySelectorAll("button")).find(
    (b) => b.textContent === "Slide left",
  )!;
  left.click();
  expect(game.update(16, idle)).toBe(true);
  expect((game.getState().board as number[]).filter(Boolean)).toHaveLength(2);
  expect(parent.querySelector('[role="status"]')?.textContent).toContain(
    "8 + 8 = 16",
  );
  left.click();
  expect(game.update(16, idle)).toBe(false);
  expect(game.getMetrics().completed).toBe(true);
  expect(game.getState().moves).toBe(2);
  game.destroy();
  expect(parent.querySelector("details")).toBeNull();
});
it("daily puzzle exhaustion is terminal and cannot be undone", () => {
  const game = new Merge2048Game();
  game.init(canvas(), { ...config, seed: 0, mode: "daily" });
  game.setState({ ...game.getState(), moves: 4 });
  expect(game.update(16, idle)).toBe(false);
  expect(game.getMetrics().completed).toBe(false);
  expect(game.getStatus()).toBe("complete");
});

describe("Raptor phrase feasibility", () => {
  for (const difficulty of ["easy", "normal", "hard"] as const)
    for (const [jump, gravity] of [
      [700, 3000],
      [850, 2500],
      [950, 1800],
    ])
      it(`${difficulty} / jump ${jump} / gravity ${gravity}: every phrase clears at maximum speed`, () => {
        for (let phrase = 0; phrase < PHRASES.length; phrase++) {
          const game = new RaptorRunGame();
          game.init(canvas(), {
            ...config,
            difficulty,
            jump_force: jump,
            gravity,
          });
          const speed =
            difficulty === "easy" ? 800 : difficulty === "hard" ? 1200 : 1000;
          const first = PHRASES[phrase].hazards[0],
            height =
              first === "bird"
                ? 25
                : first === "rock"
                  ? 28
                  : Math.min(64, ((jump * jump) / (2 * gravity)) * 0.45);
          game.setState({
            ...game.getState(),
            distance: 50000,
            score: 5000,
            gameSpeed: speed,
            phraseIndex: phrase,
            phraseStep: 1,
            spawnTimer: 0,
            spawnInterval: 1400,
            obstacles: [
              {
                x: 960,
                width: first === "bird" ? 40 : first === "rock" ? 40 : 30,
                height,
                type: first,
                y: 512 - height - (first === "bird" ? 30 : 0),
              },
            ],
          });
          for (let i = 0; i < 450; i++) {
            const s = game.getState(),
              obstacles = s.obstacles as {
                x: number;
                width: number;
                type: string;
              }[];
            const next = obstacles
              .filter((o) => o.x + o.width > 90)
              .sort((a, b) => a.x - b.x)[0];
            const action =
              !!next &&
              next.type !== "bird" &&
              next.x - 120 < speed * 0.15 &&
              !s.isJumping;
            expect(
              game.update(16, { ...idle, action, down: next?.type === "bird" }),
              `${PHRASES[phrase].name} frame ${i}`,
            ).toBe(true);
          }
        }
      });
});
it("Raptor counts close hitbox clearances, not arbitrary jumps", () => {
  const game = new RaptorRunGame();
  game.init(canvas(), config);
  const state = game.getState();
  game.setState({
    ...state,
    obstacles: [{ x: 55, width: 30, height: 28, type: "rock", y: 484 }],
    isJumping: true,
    raptorY: 250,
    raptorVelocity: 0,
  });
  game.update(16, idle);
  expect(game.getState().nearMisses).toBe(0);
  game.setState({
    ...state,
    obstacles: [
      { x: 55, width: 30, height: 25, type: "bird", y: 457, closest: 5 },
    ],
  });
  game.update(16, { ...idle, down: true });
  expect(game.getState().nearMisses).toBe(1);
  game.update(16, { ...idle, down: true });
  expect(game.getState().nearMisses).toBe(1);
});

it("arcade has six distinct sectors; classic still completes after three", () => {
  expect(new Set(ARCADE_SECTORS.map((s) => s.rows.join())).size).toBe(6);
  for (const mode of ["classic", "arcade"]) {
    const game = new BreakoutGame();
    game.init(canvas(), { ...config, mode });
    const count = mode === "arcade" ? 6 : 3;
    for (let stage = 1; stage <= count; stage++) {
      game.setState({
        ...game.getState(),
        bricks: Array(60).fill(false),
        armor: Array(60).fill(0),
      });
      expect(game.update(16, idle)).toBe(stage < count);
    }
    expect(game.getMetrics()).toMatchObject({
      completed: true,
      sectors: count,
    });
  }
});
it("arcade power-ups are timed, durable, and a lost extra ball costs no life", () => {
  const game = new BreakoutGame();
  game.init(canvas(), { ...config, mode: "arcade" });
  game.setState({
    ...game.getState(),
    launched: true,
    pickups: [
      { x: 480, y: 568, kind: "wide" },
      { x: 480, y: 568, kind: "multi" },
    ],
  });
  game.update(16, idle);
  let s = game.getState();
  expect(s.wideTime).toBe(12);
  expect(s.multiTime).toBe(10);
  expect(s.extraBalls).toHaveLength(2);
  const restored = new BreakoutGame();
  restored.init(canvas(), config);
  restored.setState(s);
  expect(restored.getState()).toEqual(s);
  game.setState({ ...s, ball: { x: 10, y: 648, vx: 0, vy: 400 } });
  game.update(16, idle);
  s = game.getState();
  expect(s.lives).toBe(3);
  expect(s.extraBalls).toHaveLength(1);
  game.setState({ ...s, wideTime: 0.01, multiTime: 0.01 });
  game.update(16, idle);
  expect(game.getState().wideTime).toBe(0);
  expect(game.getState().extraBalls).toHaveLength(0);
});
it("Flight contract selection resets its baseline, persists, and is edge-triggered", () => {
  const game = new SpaceJourney(123);
  game.gatesPassed = 4;
  for (let i = 0; i < 5; i++) {
    game.update(16, { ...idle, keys: { KeyH: true } });
    game.update(16, idle);
  }
  expect(game.contract.progress).toBe(0);
  expect(game.contractIndex).toBe(0);
  const xp = game.xp;
  game.update(16, { ...idle, keys: { KeyH: true } });
  const saved = game.getState();
  const restored = new SpaceJourney(5);
  restored.setState(saved);
  restored.update(16, { ...idle, keys: { KeyH: true } });
  expect(restored.contractChoice).toBe(game.contractChoice);
  expect(restored.xp).toBe(xp);
});
it("Flight authored routes vary and regenerate identically after restore", () => {
  const game = new SpaceJourney(123),
    restored = new SpaceJourney(9);
  restored.setState(game.getState());
  const seen = new Set([game.routeName]);
  for (let i = 0; i < 12; i++) {
    for (const g of [game, restored]) {
      g.update(16, { ...idle, keys: { KeyM: true } });
      g.update(16, idle);
    }
    seen.add(game.routeName);
    expect(restored.getState()).toEqual(game.getState());
  }
  expect(seen.size).toBeGreaterThanOrEqual(3);
});
it("Prism uses complete authored rhythms and resumes between beats", () => {
  const game = new PrismRun(42);
  for (let i = 0; i < 6; i++) game.update(100, idle);
  game.update(100, idle);
  expect(game.rows[0].safe).toBe(RHYTHMS[game.rhythm][0]);
  const restored = new PrismRun(1);
  restored.setState(game.getState());
  for (let i = 0; i < 20; i++) {
    game.update(100, idle);
    restored.update(100, idle);
    expect(restored.getState()).toEqual(game.getState());
  }
});
it("long journeys and completed sprint times survive the offline queue schema", () => {
  const data = completionSchema.parse({
    slug: "stellar-flight",
    sessionId: "123e4567-e89b-42d3-a456-426614174000",
    profileId: 1,
    seconds: 1000,
    score: 1000,
    difficulty: "normal",
    metrics: { sectors: 999, max_speed: 1200, elapsed_ms: 85321 },
  });
  expect(data.metrics).toEqual({
    sectors: 999,
    max_speed: 1200,
    elapsed_ms: 85321,
  });
  expect(timeRanked("tetris", "sprint", 1)).toBe(false);
  expect(timeRanked("tetris", "sprint", 2)).toBe(true);
  expect(formatTime(85321)).toBe("1:25.321");
});

it("Flight ships trade boost endurance, recharge, and acceleration", () => {
  const samples = new Map<
    string,
    { drain: number; recharge: number; acceleration: number }
  >();
  for (const ship of ["jet", "dart", "twin", "crescent"]) {
    const game = new SpaceJourney(123);
    game.setState({
      ...game.getState(),
      ship,
      xp: 6400,
      energy: 50,
      invulnerable: 3,
    });
    game.update(100, { ...idle, action: true });
    const after = game.energy,
      acceleration = game.controller.acceleration;
    game.update(100, idle);
    samples.set(ship, {
      drain: 50 - after,
      recharge: game.energy - after,
      acceleration,
    });
  }
  expect(samples.get("jet")!.drain).toBeLessThan(samples.get("twin")!.drain);
  expect(samples.get("crescent")!.recharge).toBeGreaterThan(
    samples.get("dart")!.recharge,
  );
  expect(samples.get("dart")!.acceleration).toBeGreaterThan(
    samples.get("jet")!.acceleration,
  );
});
