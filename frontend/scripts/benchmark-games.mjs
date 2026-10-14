import { chromium } from "@playwright/test";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import os from "node:os";
const baseUrl = process.env.BENCH_URL || "http://127.0.0.1:5175";
const output = process.env.BENCH_OUTPUT || "performance-results.json";
const software = process.env.SOFTWARE_GPU === "1";
const browser = await chromium.launch({
  executablePath:
    process.env.CHROMIUM_PATH ||
    (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
  headless: process.env.HEADFUL !== "1",
  args: [
    "--no-sandbox",
    ...(software
      ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
      : []),
  ],
});
const report = {
  date: new Date().toISOString(),
  browser: browser.version(),
  cpu: os.cpus()[0]?.model,
  logicalCpus: os.cpus().length,
  viewport: [1280, 800],
  canvasCss: [960, 640],
  dpr: 1,
  warmupSeconds: 3,
  sampleSeconds: 15,
  build: "Vite development server; engine + game, no React shell",
  softwareRequested: software,
  headless: process.env.HEADFUL !== "1",
  notes:
    "Scripted normal-mode play; auto-reset on game over. Engine + game, not full console or worst-case stress. Native hardware acceptance requires a headed browser and declared display/GPU.",
  results: [],
};
try {
  for (const slug of (
    process.env.BENCH_GAMES ||
    "snake,raptor-run,breakout,merge-2048,tetris,asteroids,prism-rush,stellar-flight"
  ).split(",")) {
    console.log("START", slug);
    const page = await browser.newPage({
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 1,
    });
    await page.route("**/__fps", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: '<!doctype html><html><head></head><body><div class="game-stage" data-state="playing" style="position:relative;width:960px;height:640px;margin:40px auto"><canvas style="display:block;width:960px;height:640px"></canvas></div></body></html>',
      }),
    );
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`${baseUrl}/__fps`);
    const result = await page.evaluate(async (slug) => {
      await import("/src/index.css");
      const { getDescriptor } = await import("/src/games/descriptors.ts");
      const { GameEngine } = await import("/src/sdk/GameEngine.ts");
      const { useSettingsStore } = await import("/src/stores/settingsStore.ts");
      useSettingsStore.setState({ muted: true, reducedMotion: false });
      await document.fonts.ready;
      const descriptor = getDescriptor(slug),
        game = await descriptor.load(),
        engine = new GameEngine();
      const canvas = document.querySelector("canvas");
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
      const initial = game.getState();
      let resets = 0,
        error = null;
      engine.onError((e) => {
        error = e.message;
      });
      engine.onGameOver(() => {
        resets++;
        game.setState(initial);
        engine.start();
      });
      const base = performance.now();
      engine.input.getState = () => {
        const input = {
          up: false,
          down: false,
          left: false,
          right: false,
          action: false,
          cancel: false,
          pause: false,
          keys: {},
        };
        const t = performance.now() - base;
        if (slug === "snake") {
          const h = game.snake[0];
          let d = game.direction;
          if (d === "right" && h.x >= game.cols - 2) d = "down";
          else if (d === "down" && h.y >= game.rows - 2) d = "left";
          else if (d === "left" && h.x <= 1) d = "up";
          else if (d === "up" && h.y <= 1) d = "right";
          input[d] = true;
        } else if (slug === "raptor-run") {
          let next = null;
          for (const o of game.obstacles)
            if (o.x + o.width > 90 && (!next || o.x < next.x)) next = o;
          input.action =
            !!next &&
            next.type !== "bird" &&
            next.x - 120 < game.gameSpeed * 0.15 &&
            !game.isJumping;
          input.down = next?.type === "bird";
        } else if (slug === "breakout") {
          input.left = game.ball.x < game.paddle - 12;
          input.right = game.ball.x > game.paddle + 12;
          input.action = Math.floor(t / 400) % 2 === 0;
        } else if (slug === "merge-2048") {
          input[["left", "down", "right", "up"][Math.floor(t / 220) % 4]] =
            true;
        } else if (slug === "tetris") {
          input.left = Math.floor(t / 900) % 3 === 0;
          input.right = Math.floor(t / 900) % 3 === 2;
          input.up = Math.floor(t / 350) % 2 === 0;
          input.action = t % 900 < 120;
        } else if (slug === "asteroids") {
          input.left = true;
          input.up = t % 1800 < 900;
          input.action = true;
        } else if (slug === "prism-rush") {
          const run = game.run;
          let next = null;
          for (const row of run.rows)
            if (!row.passed && (!next || row.z > next.z)) next = row;
          if (next && Math.floor(t / 100) % 2 === 0) {
            input.left = next.safe < run.lane;
            input.right = next.safe > run.lane;
          }
        } else if (slug === "stellar-flight") {
          input.action = t % 2000 < 1000;
        }
        return input;
      };
      let renderer = null;
      if (game.renderer) {
        const gl = game.renderer.getContext(),
          ext = gl.getExtension("WEBGL_debug_renderer_info");
        renderer = ext
          ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
          : gl.getParameter(gl.RENDERER);
      }
      engine.start();
      await new Promise((r) => setTimeout(r, 3000));
      engine.samples = [];
      const start = performance.now(),
        startResets = resets;
      await new Promise((r) => setTimeout(r, 15000));
      engine.stop();
      const wallMs = performance.now() - start,
        samples = engine.samples.filter((v) => v > 0),
        sorted = [...samples].sort((a, b) => a - b);
      const p = (n) =>
        sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * n))];
      const result = {
        slug,
        mode: descriptor.modes[0].id,
        frames: samples.length,
        wallMs: Math.round(wallMs),
        averageFps: Number(
          (
            (samples.length * 1000) /
            samples.reduce((a, b) => a + b, 0)
          ).toFixed(1),
        ),
        medianFrameMs: Number(p(0.5)?.toFixed(1)),
        p95FrameMs: Number(p(0.95)?.toFixed(1)),
        slowFramesOver33ms: samples.filter((v) => v > 33.4).length,
        resets: resets - startResets,
        renderer,
        buffer: [canvas.width, canvas.height],
        score: game.getScore(),
        error,
      };
      result.renderInfo = game.getRenderInfo?.();
      if (game.renderer) result.drawCalls = game.renderer.info.render.calls;
      engine.destroy();
      return result;
    }, slug);
    result.pageErrors = errors;
    report.results.push(result);
    console.log(JSON.stringify(result));
    await writeFile(output, JSON.stringify(report, null, 2) + "\n");
    await page.close();
  }
} finally {
  await browser.close();
}
