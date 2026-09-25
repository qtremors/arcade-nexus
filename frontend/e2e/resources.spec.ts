import { test, expect } from "./fixtures";
import type { GameInstance } from "../src/sdk/GameSDK";
import type { GameEngine } from "../src/sdk/GameEngine";
type Reference = {
  game: WeakRef<GameInstance>;
  engine: WeakRef<GameEngine>;
  canvas: WeakRef<HTMLCanvasElement>;
};
for (const slug of ["prism-rush", "stellar-flight"])
  test(`${slug} releases game, engine and canvas objects across repeated entries`, async ({
    page,
  }) => {
    await page.route("**/__resource-check", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: "<!doctype html><html><body></body></html>",
      }),
    );
    await page.goto("/__resource-check");
    const cdp = await page.context().newCDPSession(page);
    for (let cycle = 0; cycle < 5; cycle++) {
      const resources = await page.evaluate(async (slug) => {
        const descriptorPath = "/src/games/descriptors.ts",
          enginePath = "/src/sdk/GameEngine.ts";
        const { getDescriptor } = await import(descriptorPath),
          { GameEngine } = await import(enginePath);
        const descriptor = getDescriptor(slug),
          game: GameInstance = await descriptor.load(),
          engine: GameEngine = new GameEngine(),
          canvas = document.createElement("canvas");
        canvas.style.cssText = "width:960px;height:640px";
        document.body.appendChild(canvas);
        await engine.init(canvas, game, {
          ...descriptor.config,
          slug,
          title: descriptor.title,
          mode: descriptor.modes[0].id,
          difficulty: "normal",
          seed: 123,
          width: 960,
          height: 640,
        });
        engine.start();
        await new Promise((resolve) => setTimeout(resolve, 150));
        const diagnostics = game.getRenderDiagnostics?.();
        engine.destroy();
        canvas.remove();
        const tracked = window as Window & { resourceReferences?: Reference[] };
        (tracked.resourceReferences ??= []).push({
          game: new WeakRef(game),
          engine: new WeakRef(engine),
          canvas: new WeakRef(canvas),
        });
        return diagnostics?.resources();
      }, slug);
      expect(resources).toEqual({ geometries: 0, textures: 0 });
      await page.waitForTimeout(50);
      await cdp.send("HeapProfiler.collectGarbage");
    }
    await cdp.send("HeapProfiler.collectGarbage");
    const retained = await page.evaluate(() => {
      const refs =
        (window as Window & { resourceReferences?: Reference[] })
          .resourceReferences ?? [];
      return {
        entries: refs.length,
        games: refs.filter((ref) => ref.game.deref()).length,
        engines: refs.filter((ref) => ref.engine.deref()).length,
        canvases: refs.filter((ref) => ref.canvas.deref()).length,
      };
    });
    expect(retained).toEqual({ entries: 5, games: 0, engines: 0, canvases: 0 });
    await cdp.detach();
  });
