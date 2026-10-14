import { chromium } from "@playwright/test";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import os from "node:os";
const baseUrl = process.env.BENCH_URL || "http://127.0.0.1:5175";
const output = process.env.BENCH_OUTPUT || "performance-results.json";
const software = process.env.SOFTWARE_GPU === "1";
const wide = process.env.BENCH_WIDE === "1";
const viewport = wide ? [1920, 1080] : [1280, 800];
const warmupSeconds = Number(process.env.BENCH_WARMUP_SECONDS || 3);
const sampleSeconds = Number(process.env.BENCH_SAMPLE_SECONDS || 15);
const reentryCycles = Number(process.env.BENCH_REENTRY_CYCLES || 0);
if (
  !Number.isInteger(reentryCycles) ||
  reentryCycles < 0 ||
  reentryCycles > 100
)
  throw new Error("Reentry cycles must be an integer from 0 to 100");
const catalog = JSON.parse(
  await readFile(new URL("../../catalog.json", import.meta.url), "utf8"),
);
const cases = [];
for (const slug of (
  process.env.BENCH_GAMES || Object.keys(catalog).join(",")
).split(",")) {
  if (!catalog[slug]) throw new Error(`Unknown game: ${slug}`);
  const modes =
    process.env.BENCH_MODES === "all"
      ? catalog[slug].modes
      : catalog[slug].modes.slice(0, 1);
  for (const mode of modes) {
    cases.push({ slug, mode: mode.id, scenario: "normal" });
    if (
      process.env.BENCH_STRESS === "1" &&
      ["prism-rush", "stellar-flight"].includes(slug)
    )
      cases.push({ slug, mode: mode.id, scenario: "late-run" });
  }
}
if (
  ![warmupSeconds, sampleSeconds].every(
    (n) => Number.isFinite(n) && n > 0 && n <= 3600,
  )
)
  throw new Error("Benchmark durations must be between 0 and 3600 seconds");
const browser = await chromium.launch({
  ...(process.env.BROWSER_CHANNEL
    ? { channel: process.env.BROWSER_CHANNEL }
    : {}),
  executablePath:
    process.env.CHROMIUM_PATH ||
    (!process.env.BROWSER_CHANNEL && existsSync("/usr/bin/chromium")
      ? "/usr/bin/chromium"
      : undefined),
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
  availableParallelism: os.availableParallelism(),
  operatingSystem: `${os.platform()} ${os.release()} ${os.arch()}`,
  hostMemoryBytes: os.totalmem(),
  targetDevice: process.env.BENCH_LABEL || "unspecified",
  declaredPower: process.env.BENCH_POWER || "unknown",
  viewport,
  canvasCss: wide ? "1920×1080 for 3D; 1620×1080 for 3:2 games" : [960, 640],
  dpr: 1,
  warmupSeconds,
  sampleSeconds,
  reentryCycles,
  plannedCases: cases,
  completed: false,
  build: "Vite development server; engine + game, no React shell",
  softwareRequested: software,
  headless: process.env.HEADFUL !== "1",
  notes:
    "Scripted normal-mode play; auto-reset on game over. Engine + game, not full console or worst-case stress. Native hardware acceptance requires a headed browser and declared display/GPU.",
  results: [],
};
try {
  for (const { slug, mode, scenario } of cases) {
    console.log("START", slug, mode, scenario);
    const canvasSize = wide
      ? [["prism-rush", "stellar-flight"].includes(slug) ? 1920 : 1620, 1080]
      : [960, 640];
    const page = await browser.newPage({
      viewport: { width: viewport[0], height: viewport[1] },
      deviceScaleFactor: 1,
    });
    await page.route("**/__fps", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: `<!doctype html><html><head></head><body style="margin:0"><div class="game-stage" data-state="playing" style="position:relative;padding:0;width:${canvasSize[0]}px;height:${canvasSize[1]}px;margin:0 auto"><canvas style="display:block;flex:none;width:${canvasSize[0]}px;height:${canvasSize[1]}px"></canvas></div></body></html>`,
      }),
    );
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`${baseUrl}/__fps`);
    const result = await page.evaluate(
      async ({ slug, mode, scenario, warmupSeconds, sampleSeconds }) => {
        await import("/src/index.css");
        const { getDescriptor } = await import("/src/games/descriptors.ts");
        const { GameEngine } = await import("/src/sdk/GameEngine.ts");
        const { useSettingsStore } =
          await import("/src/stores/settingsStore.ts");
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
          mode,
          difficulty: "normal",
          seed: 123,
          width: 960,
          height: 640,
        });
        let initial = game.getState();
        let fixture = "Seeded first-run state";
        if (scenario === "late-run" && slug === "prism-rush") {
          game.setState({
            ...initial,
            distance: 6000,
            elapsed: 240,
            rows: [0, 1, 2].map((id) => ({
              id,
              z: -85 + id * 35,
              safe: 1,
              passed: false,
            })),
            nextId: 3,
            spawn: 1.65,
          });
          initial = game.getState();
          fixture =
            "Validated save at maximum normal-mode speed with three visible gates";
        }
        if (scenario === "late-run" && slug === "stellar-flight") {
          let triangles = -1;
          for (const position of [
            [0, 300, 0],
            [2400, 300, -2400],
            [4800, 300, 4800],
          ])
            for (let view = 0; view < 4; view++) {
              const angle = (view * Math.PI) / 2;
              game.setState({
                ...initial,
                position,
                rotation: [0, Math.sin(angle / 2), 0, Math.cos(angle / 2)],
                speed: 300,
                bestSpeed: 300,
              });
              game.render();
              if (game.renderer.info.render.triangles > triangles) {
                triangles = game.renderer.info.render.triangles;
                fixture = game.getState();
              }
            }
          initial = fixture;
          game.setState(initial);
          fixture =
            "Densest submitted geometry among twelve seeded position/yaw samples, with boost and turns";
        }
        const work = [],
          drawCalls = [],
          triangles = [];
        const render = game.render.bind(game);
        game.render = (...args) => {
          const start = performance.now();
          render(...args);
          work.push(performance.now() - start);
          if (game.renderer) {
            drawCalls.push(game.renderer.info.render.calls);
            triangles.push(game.renderer.info.render.triangles);
          }
        };
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
            if (scenario === "late-run") {
              input.action = true;
              input.left = Math.floor(t / 3000) % 4 === 0;
              input.right = Math.floor(t / 3000) % 4 === 2;
            }
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
        await new Promise((r) => setTimeout(r, warmupSeconds * 1000));
        engine.samples = [];
        work.length = drawCalls.length = triangles.length = 0;
        const start = performance.now(),
          startResets = resets;
        await new Promise((r) => setTimeout(r, sampleSeconds * 1000));
        engine.stop();
        const wallMs = performance.now() - start,
          samples = engine.samples.filter((v) => v > 0),
          sorted = [...samples].sort((a, b) => a - b);
        const p = (n) =>
          sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * n))];
        const result = {
          slug,
          mode,
          scenario,
          fixture,
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
        const { graphicsCapabilities } =
          await import("/src/sdk/GraphicsQuality.ts");
        const capabilities = graphicsCapabilities();
        const selectedRenderer = renderer ?? capabilities.renderer;
        result.hardware = {
          ...capabilities,
          renderer: selectedRenderer,
          software: selectedRenderer
            ? /swiftshader|llvmpipe|softpipe|software|microsoft basic render/i.test(
                selectedRenderer,
              )
            : capabilities.software,
          probeRenderer: capabilities.renderer,
          userAgent: navigator.userAgent,
          logicalCpus: navigator.hardwareConcurrency,
          deviceMemoryGiB: navigator.deviceMemory ?? null,
          display: {
            width: screen.width,
            height: screen.height,
            colorDepth: screen.colorDepth,
            dpr: devicePixelRatio,
          },
          contextAntialiasing:
            game.renderer?.getContext().getContextAttributes()?.antialias ??
            null,
        };
        result.renderInfo = game.getRenderInfo?.();
        const average = (values) =>
          values.length
            ? Number(
                (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2),
              )
            : null;
        const sortedWork = [...work].sort((a, b) => a - b);
        result.renderSubmitMs = {
          average: average(work),
          p95: Number(
            sortedWork[
              Math.min(
                sortedWork.length - 1,
                Math.floor(sortedWork.length * 0.95),
              )
            ]?.toFixed(2),
          ),
        };
        if (game.renderer) {
          result.drawCalls = {
            average: average(drawCalls),
            max: drawCalls.reduce((max, value) => Math.max(max, value), 0),
          };
          result.triangles = {
            average: average(triangles),
            max: triangles.reduce((max, value) => Math.max(max, value), 0),
          };
          result.gpuResources = { ...game.renderer.info.memory };
        }
        const rendererInfo = game.renderer?.info;
        engine.destroy();
        if (rendererInfo)
          result.afterDestroyGpuResources = { ...rendererInfo.memory };
        return result;
      },
      { slug, mode, scenario, warmupSeconds, sampleSeconds },
    );
    if (reentryCycles) {
      const devtools = await page.context().newCDPSession(page);
      result.reentry = [];
      for (let cycle = 1; cycle <= reentryCycles; cycle++) {
        const released = await page.evaluate(
          async ({ slug, mode }) => {
            const { getDescriptor } = await import("/src/games/descriptors.ts");
            const { GameEngine } = await import("/src/sdk/GameEngine.ts");
            const descriptor = getDescriptor(slug),
              game = await descriptor.load(),
              engine = new GameEngine();
            const canvas = document.createElement("canvas");
            const previous = document.querySelector("canvas");
            canvas.style.cssText = previous.style.cssText;
            previous.replaceWith(canvas);
            await engine.init(canvas, game, {
              ...descriptor.config,
              slug,
              title: descriptor.title,
              mode,
              difficulty: "normal",
              seed: 123,
              width: 960,
              height: 640,
            });
            engine.start();
            await new Promise((resolve) => setTimeout(resolve, 150));
            engine.stop();
            const info = game.renderer?.info;
            engine.destroy();
            return info ? { ...info.memory } : null;
          },
          { slug, mode },
        );
        await devtools.send("HeapProfiler.collectGarbage");
        const heap = await devtools.send("Runtime.getHeapUsage");
        result.reentry.push({
          cycle,
          usedHeapBytes: heap.usedSize,
          releasedGpuResources: released,
        });
      }
      await devtools.detach();
    }
    result.pageErrors = errors;
    const expectedWidth =
      wide && ["prism-rush", "stellar-flight"].includes(slug) ? 1920 : 1620;
    if (result.buffer[0] !== expectedWidth || result.buffer[1] !== 1080)
      throw new Error(
        `${slug}: unexpected rendering buffer ${result.buffer.join("×")}`,
      );
    if (!result.frames)
      throw new Error(`${slug}: no rendered frames were sampled`);
    if (result.error || errors.length)
      throw new Error(`${slug}: ${result.error || errors.join("; ")}`);
    report.results.push(result);
    report.completed = report.results.length === cases.length;
    report.qualification = {
      nativeGpuReported: report.results.every(
        (item) =>
          item.hardware?.renderer &&
          !item.hardware.software &&
          /intel|radeon|nvidia|apple|adreno|mali|amd/i.test(
            item.hardware.renderer,
          ),
      ),
      targetCpuDetected: /(?:i7[-\s]?12\d{2}|12th Gen.*i7)/i.test(
        report.cpu ?? "",
      ),
      headed: !report.headless,
      fullHd: wide,
      sampleAtLeast60Seconds: sampleSeconds >= 60,
      powerDeclared: ["ac", "battery"].includes(report.declaredPower),
      scope:
        "Engine diagnostic with scripted play and optional validated late-run saves; inspect resets and per-scenario pacing. Full-console, physical input latency, visual quality and thermal acceptance require the manual checklist.",
    };
    console.log(JSON.stringify(result));
    await writeFile(output, JSON.stringify(report, null, 2) + "\n");
    await page.close();
  }
} finally {
  await browser.close();
}
