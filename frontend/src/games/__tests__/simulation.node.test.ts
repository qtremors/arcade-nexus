import { expect, it } from "vitest";
import { RaptorSimulation } from "../raptor-run/RaptorSimulation";
import { PrismRun } from "../prism-rush/PrismRun";
import { parseState as parseTetris } from "../tetris/codec";
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
it("restores Raptor's next-step trajectory without browser globals or effects", () => {
  expect(typeof document).toBe("undefined");
  const first = new RaptorSimulation();
  first.configure(960, 640, { slug: "raptor-run", title: "Raptor", seed: 123 });
  for (let step = 0; step < 90; step++) first.update(1000 / 60, idle);
  const second = new RaptorSimulation();
  second.configure(960, 640, {
    slug: "raptor-run",
    title: "Raptor",
    seed: 999,
  });
  second.setState(first.getState());
  for (let step = 0; step < 240; step++) {
    const input = { ...idle, action: step % 90 < 2 };
    expect(second.update(1000 / 60, input)).toBe(
      first.update(1000 / 60, input),
    );
    expect(second.getState()).toEqual(first.getState());
  }
});
it("validates Prism and Tetris saves without constructing a game or renderer", () => {
  const first = new PrismRun(123),
    second = new PrismRun(999);
  first.update(16, idle);
  second.setState(first.getState());
  first.update(16, idle);
  second.update(16, idle);
  expect(second.getState()).toEqual(first.getState());
  expect(() => parseTetris({ version: 1 })).toThrow();
});
