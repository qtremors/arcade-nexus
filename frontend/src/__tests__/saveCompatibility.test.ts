import { expect, it } from "vitest";
import { readSave, validateSave } from "../services/saves";
import { RaptorRunGame } from "../games/raptor-run/RaptorRun";
const canvas = { width: 960, height: 640 } as HTMLCanvasElement;
it("opens legacy Raptor envelopes that carried the old unused physics configuration", async () => {
  const original = new RaptorRunGame();
  original.init(canvas, { slug: "raptor-run", title: "Raptor" });
  const snapshot = original.getState();
  const data = await validateSave(
    {
      format: 1,
      game: "raptor-run",
      difficulty: "normal",
      rules_version: 1,
      config: { gravity: 1500, jump_force: 600, initial_speed: 400 },
      state: snapshot,
    },
    "raptor-run",
  );
  const restored = new RaptorRunGame();
  expect(() =>
    restored.init(canvas, {
      ...data.config,
      slug: "raptor-run",
      title: "Raptor",
    }),
  ).not.toThrow();
  restored.setState(data.state);
  expect(restored.getState()).toEqual(snapshot);
});
it("preserves supported custom Raptor physics and does not rewrite current invalid saves", () => {
  const data = {
    format: 2,
    game: "raptor-run",
    difficulty: "normal",
    rules_version: 1,
    config: { gravity: 2800, jump_force: 900 },
    state: {},
  };
  expect(readSave(data, "raptor-run").config).toEqual(data.config);
  expect(
    readSave(
      { ...data, rules_version: 3, config: { gravity: 1500 } },
      "raptor-run",
    ).config.gravity,
  ).toBe(1500);
});
