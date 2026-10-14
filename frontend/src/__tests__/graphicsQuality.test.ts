import { afterEach, expect, it, vi } from "vitest";
import { fullHdScale } from "../sdk/GraphicsQuality";
import * as graphics from "../sdk/GraphicsQuality";
import { GameEngine } from "../sdk/GameEngine";
import { recordMeasurement, recentMeasurements } from "../services/performance";
import type { Game2DInstance } from "../sdk/GameSDK";
afterEach(() => vi.unstubAllGlobals());
it("uses Full HD buffers without stretching wide, classic or narrow playfields", () => {
  expect(fullHdScale(1280, 720)).toBe(1.5);
  expect(fullHdScale(960, 640) * 640).toBe(1080);
  expect(fullHdScale(960, 640) * 960).toBe(1620);
  expect(fullHdScale(3840, 2160)).toBe(0.5);
  expect(fullHdScale(390, 844) * 844).toBe(1080);
});
it.each([true, false])(
  "2D selects CPU raster only for software GPUs (%s)",
  async (software) => {
    vi.spyOn(graphics, "graphicsCapabilities").mockReturnValue({
      software,
      renderer: "test",
    });
    const setTransform = vi.fn();
    const getContext = vi.fn(() => ({ setTransform }));
    const canvas = {
      width: 960,
      height: 640,
      getContext,
    } as unknown as HTMLCanvasElement;
    const game: Game2DInstance = {
      type: "2d",
      init: (canvas) => {
        expect([canvas.width, canvas.height]).toEqual([960, 640]);
      },
      update: () => true,
      render: () => {},
    };
    const engine = new GameEngine();
    await engine.init(canvas, game, { slug: "test", title: "Test" });
    expect(getContext).toHaveBeenCalledWith("2d", {
      alpha: false,
      desynchronized: true,
      willReadFrequently: software,
    });
    expect([canvas.width, canvas.height]).toEqual([1620, 1080]);
    expect(setTransform).toHaveBeenCalledWith(1.6875, 0, 0, 1.6875, 0, 0);
    engine.destroy();
  },
);
it("the engine renders at 120 Hz while retaining fixed 60 Hz gameplay", async () => {
  let callback: FrameRequestCallback = () => {};
  vi.spyOn(performance, "now").mockReturnValue(0);
  vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => {
    callback = fn;
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {});
  const game: Game2DInstance = {
    type: "2d",
    init: () => {},
    update: vi.fn(() => true),
    render: vi.fn(),
  };
  const engine = new GameEngine();
  await engine.init(
    {
      width: 0,
      height: 0,
      getContext: () => ({ setTransform: vi.fn() }),
    } as unknown as HTMLCanvasElement,
    game,
    { slug: "test", title: "Test" },
  );
  engine.start();
  for (let i = 1; i <= 12; i++) callback((i * 1000) / 120 + 0.001);
  expect(game.update).toHaveBeenCalledTimes(6);
  expect(game.render).toHaveBeenCalledTimes(13);
  engine.destroy();
});
it("exports real average FPS, tail frame time and render resolution", () => {
  localStorage.clear();
  recordMeasurement("flight", 100, [10, 10, 20, NaN, 0], {
    width: 640,
    height: 400,
    quality: "balanced",
  });
  expect(recentMeasurements()[0]).toMatchObject({
    averageFps: 75,
    frames: 3,
    p50: 10,
    p95: 20,
    width: 640,
    height: 400,
    quality: "balanced",
  });
});
