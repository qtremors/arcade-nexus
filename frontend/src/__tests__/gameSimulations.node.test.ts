import { expect, it } from "vitest";
import { SnakeSimulation } from "../games/snake/SnakeSimulation";
import { BreakoutSimulation } from "../games/breakout/BreakoutSimulation";
import { Merge2048Simulation } from "../games/merge-2048/Merge2048Simulation";
import { TetrisSimulation } from "../games/tetris/TetrisSimulation";
import { AsteroidsSimulation } from "../games/asteroids/AsteroidsSimulation";
import { RaptorSimulation } from "../games/raptor-run/RaptorSimulation";
import { getGameDefinition } from "../games/catalog";
import { limits, metricsSchema } from "../contracts/gameplay";
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
const cases = [
  ["snake", SnakeSimulation],
  ["breakout", BreakoutSimulation],
  ["merge-2048", Merge2048Simulation],
  ["tetris", TetrisSimulation],
  ["asteroids", AsteroidsSimulation],
] as const;
for (const [slug, Simulation] of cases)
  for (const mode of getGameDefinition(slug).modes) {
    it(`${slug}/${mode.id} restores its seeded future without a DOM or renderer`, () => {
      expect(typeof document).toBe("undefined");
      const config = {
        slug,
        title: slug,
        mode: mode.id,
        seed: 123,
        difficulty: "normal" as const,
      };
      const original = new Simulation(),
        restored = new Simulation();
      original.configure(960, 640, config);
      restored.configure(960, 640, { ...config, seed: 999 });
      for (let step = 0; step < 10; step++) original.update(16, idle);
      const snapshot = original.getState();
      restored.setState(snapshot);
      expect(restored.getState()).toEqual(snapshot);
      for (let step = 0; step < 300; step++) {
        const direction = Math.floor(step / 45) % 4;
        const input = {
          ...idle,
          left: direction === 0,
          right: direction === 1,
          up: direction === 2,
          down: direction === 3,
          action: step % 70 === 0,
        };
        expect(restored.update(16, input)).toBe(original.update(16, input));
        expect(restored.getState()).toEqual(original.getState());
      }
      original.destroy();
      restored.destroy();
    });
  }
it("keeps Raptor's result and recovery valid when a restored jump counter reaches its ceiling", () => {
  const run = new RaptorSimulation();
  run.configure(960, 640, { slug: "raptor-run", title: "Raptor", seed: 1 });
  run.setState({ ...run.getState(), jumps: limits.count });
  expect(() => run.update(16, { ...idle, action: true })).toThrow(
    /progress limit/,
  );
  expect(metricsSchema.parse(run.getMetrics()).jumps).toBe(limits.count);
  const restored = new RaptorSimulation();
  restored.configure(960, 640, { slug: "raptor-run", title: "Raptor" });
  expect(() => restored.setState(run.getState())).not.toThrow();
});
it("keeps Asteroids' last valid sector count when an extreme wave cannot advance", () => {
  const run = new AsteroidsSimulation();
  run.configure(960, 640, { slug: "asteroids", title: "Asteroids", seed: 1 });
  run.setState({
    ...run.getState(),
    wave: limits.count + 1,
    rocks: [],
    intermission: 0,
  });
  expect(() => run.update(16, idle)).toThrow(/progress limit/);
  expect(metricsSchema.parse(run.getMetrics()).sectors).toBe(limits.count);
  const restored = new AsteroidsSimulation();
  restored.configure(960, 640);
  expect(() => restored.setState(run.getState())).not.toThrow();
});
