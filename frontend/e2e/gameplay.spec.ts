import { captureScreenshot } from "./fixtures";
import { test, expect, start, pause, save } from "./fixtures";

test("Snake, Raptor, and Breakout respond to controls, pause, saves, and resize", async ({
  page,
  request,
  profileId,
}, info) => {
  for (const slug of ["snake", "raptor-run", "breakout"]) {
    await start(page, slug);
    if (slug === "snake") await page.keyboard.press("ArrowUp", { delay: 100 });
    if (slug === "raptor-run")
      await page.keyboard.press("Space", { delay: 300 });
    if (slug === "breakout") {
      await page.keyboard.press("Space", { delay: 100 });
      await page.keyboard.press("ArrowRight", { delay: 300 });
    }
    await captureScreenshot(page, { path: info.outputPath(`${slug}.png`) });
    await pause(page);
    const before = await save(page, slug);
    await page.setViewportSize({ width: 800, height: 600 });
    const after = await save(page, slug, 2);
    expect(after).toEqual(before);
    await page.getByRole("button", { name: "Resume", exact: true }).click();
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await expect(
      page.getByRole("heading", { name: "Paused", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Quit to console" }).click();
    await expect(page).toHaveURL(/\/home$/);
    await page.setViewportSize({ width: 1440, height: 900 });
    const history = (await (
      await request.get("/api/stats/sessions", {
        headers: { "X-Profile-ID": String(profileId) },
      })
    ).json()) as { game_slug: string; metrics: Record<string, unknown> }[];
    expect(history.filter((s) => s.game_slug === slug)).toHaveLength(1);
    if (slug === "raptor-run")
      expect(
        history.find((s) => s.game_slug === slug)!.metrics.jumps,
      ).toBeGreaterThan(0);
  }
});

test("Stellar Flight loads space, boosts, switches ships, and saves", async ({
  page,
  request,
  profileId,
}, info) => {
  await page.goto("/play/stellar-flight?mode=endless");
  await page.getByRole("button", { name: "Start game", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Pause (Esc / P)" }),
  ).toBeVisible();
  await page.keyboard.down("ShiftLeft");
  await expect(page.locator(".flight-hud")).toContainText("Speed 3", {
    timeout: 20000,
  });
  await expect
    .poll(
      async () => {
        const hud = await page.locator(".flight-hud").textContent();
        return Number(hud?.match(/Speed (\d+)/)?.[1]);
      },
      { timeout: 10000 },
    )
    .toBeGreaterThanOrEqual(340);
  await page.keyboard.up("ShiftLeft");
  await expect(page.locator(".flight-hud")).toContainText("Nova Dart");
  await captureScreenshot(page, { path: info.outputPath("flight-dart.png") });
  await page.keyboard.press("KeyV", { delay: 100 });
  await expect(page.locator(".flight-hud")).toContainText("Legacy Jet");
  await page.keyboard.press("KeyM", { delay: 100 });
  await expect(page.locator(".flight-hud")).toContainText(
    "New race plotted ahead",
  );
  await captureScreenshot(page, { path: info.outputPath("flight.png") });
  await pause(page);
  const state = await save(page, "stellar-flight");
  expect(Number(state.bestSpeed)).toBeGreaterThanOrEqual(340);
  await page.getByRole("button", { name: "Quit to console" }).click();
  await expect(page.getByText("Select Experience")).toBeVisible();
  const awards = (await (
    await request.get("/api/achievements/stellar-flight", {
      headers: { "X-Profile-ID": String(profileId) },
    })
  ).json()) as { achievements: { slug: string; unlocked: boolean }[] };
  expect(awards.achievements.find((a) => a.slug === "mach-1")!.unlocked).toBe(
    true,
  );
});

test("Flight renders and saves every unlocked ship", async ({
  page,
  request,
  profileId,
}, info) => {
  await start(page, "stellar-flight");
  await pause(page);
  const state = await save(page, "stellar-flight");
  const response = await request.post("/api/saves/stellar-flight", {
    headers: { "X-Profile-ID": String(profileId) },
    data: {
      slot: 2,
      data: {
        format: 2,
        game: "stellar-flight",
        mode: "endless",
        rules_version: 4,
        difficulty: "normal",
        state: { ...state, xp: 6400, ship: "dart" },
      },
    },
  });
  expect(response.ok()).toBeTruthy();
  await page.getByRole("button", { name: "Quit to console" }).click();
  await page.getByText("Select Experience").waitFor();
  await page.goto("/play/stellar-flight");
  await page.getByRole("button", { name: "Load game", exact: true }).click();
  await page.getByRole("button", { name: /^Slot 2 ·/ }).click();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  for (const [name, id] of [
    ["Nova Dart", "dart"],
    ["Vanguard", "twin"],
    ["Star Manta", "crescent"],
    ["Legacy Jet", "jet"],
  ]) {
    await expect(page.locator(".flight-hud")).toContainText(name);
    await pause(page);
    const selected = await save(page, "stellar-flight");
    expect(selected.ship).toBe(id);
    await page.getByRole("button", { name: "Resume", exact: true }).click();
    await captureScreenshot(page, { path: info.outputPath(`ship-${id}.png`) });
    await page.keyboard.press("KeyV", { delay: 100 });
  }
});

test("Breakout awards medals and legacy Flight courses migrate to endless journeys", async ({
  page,
  request,
  profileId,
}, info) => {
  const headers = { "X-Profile-ID": String(profileId) };
  for (const [slug, mode, state] of [
    [
      "breakout",
      "classic",
      {
        version: 1,
        stage: 3,
        paddle: 480,
        ball: { x: 480, y: 500, vx: 150, vy: -350 },
        bricks: Array(60).fill(false),
        score: 1500,
        lives: 3,
        launched: false,
        difficulty: "normal",
        elapsed: 180000,
      },
    ],
    [
      "stellar-flight",
      "course",
      {
        version: 1,
        mode: "course",
        elapsed: 100,
        maxAltitude: 350,
        position: [0, 300, -1],
        rotation: [0, 0, 0, 1],
        speed: 100,
        bestSpeed: 100,
        map: 0,
        gatesPassed: 11,
        gatesMissed: 0,
        gate: { position: [0, 300, 0], rotation: [0, 0, 0, 1] },
      },
    ],
  ] as const) {
    expect(
      (
        await request.post(`/api/saves/${slug}`, {
          headers,
          data: {
            slot: 1,
            data: {
              format: 2,
              game: slug,
              mode,
              rules_version: 2,
              difficulty: "normal",
              state,
            },
          },
        })
      ).ok(),
    ).toBeTruthy();
    await page.goto(`/play/${slug}`);
    await page.getByRole("button", { name: "Load game", exact: true }).click();
    await page.getByRole("button", { name: /^Slot 1 ·/ }).click();
    await page.getByRole("button", { name: "Resume", exact: true }).click();
    if (slug === "stellar-flight") {
      await expect(
        page.getByRole("button", { name: "Pause (Esc / P)" }),
      ).toBeVisible();
      await expect(page.locator(".flight-hud")).toContainText(
        "Gates 11 cleared",
      );
      await pause(page);
      const migrated = await save(page, "stellar-flight");
      expect(migrated.version).toBe(2);
      expect(migrated.mode).toBe("endless");
      expect(Number(migrated.xp)).toBeGreaterThan(0);
      await captureScreenshot(page, {
        path: info.outputPath("flight-migrated.png"),
      });
      continue;
    }
    await expect(page.getByText("GOLD MEDAL", { exact: true })).toBeVisible();
    await expect(page.getByLabel("New achievements")).toBeVisible();
    await captureScreenshot(page, {
      path: info.outputPath(`${slug}-complete.png`),
    });
    const history = (
      await (await request.get("/api/progress/history", { headers })).json()
    ).sessions;
    expect(
      history.find((s: { game_slug: string }) => s.game_slug === slug).metrics
        .completed,
    ).toBe(true);
  }
});

test("daily 2048 is playable through its semantic board and records a solved puzzle", async ({
  page,
  request,
  profileId,
}, info) => {
  const headers = { "X-Profile-ID": String(profileId) };
  await request.post("/api/saves/merge-2048", {
    headers,
    data: {
      slot: 1,
      data: {
        format: 2,
        game: "merge-2048",
        mode: "daily",
        rules_version: 3,
        difficulty: "normal",
        config: { challenge_date: "2026-10-13" },
        state: {
          version: 1,
          mode: "daily",
          puzzle: 0,
          moves: 0,
          score: 0,
          randomState: 42,
          board: [8, 8, 16, 0, ...Array(12).fill(0)],
        },
      },
    },
  });
  await page.goto("/play/merge-2048");
  await page.getByRole("button", { name: "Load game", exact: true }).click();
  await page.getByRole("button", { name: /^Slot 1 ·/ }).click();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Pause (Esc / P)" }),
  ).toBeVisible();
  await page
    .getByText("Board reader & move explanations", { exact: true })
    .click();
  await expect(page.getByRole("table", { name: "2048 board" })).toBeVisible();
  await page.getByRole("button", { name: "Slide left", exact: true }).focus();
  await page.keyboard.press("Space");
  await expect(page.locator(".puzzle-explanation")).toContainText("8 + 8 = 16");
  await captureScreenshot(page, { path: info.outputPath("2048-reader.png") });
  await page.getByRole("button", { name: "Slide left", exact: true }).focus();
  await page.keyboard.press("Space");
  await expect(
    page.getByRole("heading", { name: "Daily puzzle solved" }),
  ).toBeVisible();
  await expect
    .poll(async () =>
      (
        await (await request.get("/api/progress/records", { headers })).json()
      ).some((r: { mode: string }) => r.mode === "daily-2026-10-13"),
    )
    .toBe(true);
});

test("arcade pickups survive saving and Flight contracts can be selected", async ({
  page,
  request,
  profileId,
}, info) => {
  const headers = { "X-Profile-ID": String(profileId) };
  await request.post("/api/saves/breakout", {
    headers,
    data: {
      slot: 1,
      data: {
        format: 2,
        game: "breakout",
        mode: "arcade",
        rules_version: 2,
        difficulty: "normal",
        state: {
          version: 1,
          mode: "arcade",
          stage: 4,
          paddle: 480,
          ball: { x: 480, y: 550, vx: 0, vy: -350 },
          bricks: Array(60).fill(true),
          score: 500,
          lives: 3,
          launched: true,
          difficulty: "normal",
          pickups: [
            { x: 480, y: 568, kind: "wide" },
            { x: 480, y: 568, kind: "multi" },
          ],
        },
      },
    },
  });
  await page.goto("/play/breakout");
  await page.getByRole("button", { name: "Load game", exact: true }).click();
  await page.getByRole("button", { name: /^Slot 1 ·/ }).click();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Pause (Esc / P)" }),
  ).toBeVisible();
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
      ),
  );
  await pause(page);
  const saved = await save(page, "breakout", 2);
  expect(Number(saved.wideTime)).toBeGreaterThan(0);
  expect(Number(saved.multiTime)).toBeGreaterThan(0);
  expect(saved.extraBalls).toHaveLength(2);
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Pause (Esc / P)" }),
  ).toBeVisible();
  await captureScreenshot(page, {
    path: info.outputPath("breakout-arcade.png"),
  });
  await pause(page);
  await start(page, "stellar-flight");
  await expect(page.locator(".flight-hud")).toContainText("Race rings");
  await page.keyboard.press("KeyH", { delay: 80 });
  await expect(page.locator(".flight-hud")).toContainText("Chart new sectors");
  await page.keyboard.press("KeyN", { delay: 80 });
  await expect(page.locator(".flight-hud")).toContainText("SURVEY");
  await captureScreenshot(page, {
    path: info.outputPath("flight-contract-survey.png"),
  });
  await pause(page);
  const flight = await save(page, "stellar-flight");
  expect(flight.contractChoice).toBe(1);
  expect(flight.navigation).toBe("explore");
});

test("all games retain Full HD detail and 3D antialiasing", async ({
  page,
}) => {
  test.setTimeout(120000);
  for (const slug of [
    "snake",
    "raptor-run",
    "breakout",
    "merge-2048",
    "tetris",
    "asteroids",
    "prism-rush",
    "stellar-flight",
  ]) {
    await start(page, slug);
    // Exercise actual rendered frames, including the software GPU under load.
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          let frames = 0;
          const next = () =>
            ++frames >= 12 ? resolve() : requestAnimationFrame(next);
          requestAnimationFrame(next);
        }),
    );
    const detail = await page
      .locator("canvas.game-canvas")
      .evaluate((canvas: HTMLCanvasElement, slug) => {
        const gl = ["prism-rush", "stellar-flight"].includes(slug)
          ? canvas.getContext("webgl2")
          : null;
        return {
          width: canvas.width,
          height: canvas.height,
          antialias: gl?.getContextAttributes()?.antialias,
        };
      }, slug);
    expect(detail.height, slug).toBe(1080);
    expect(detail.width, slug).toBeLessThanOrEqual(1920);
    if (["prism-rush", "stellar-flight"].includes(slug))
      expect(detail.antialias, slug).toBe(true);
  }
});

test("software Canvas 2D paints a detailed Full HD playfield", async ({
  page,
}, info) => {
  await page.goto("/play/snake");
  await page.getByRole("button", { name: "Start game", exact: true }).click();
  const canvas = page.locator("canvas.game-canvas");
  await expect(
    page.getByRole("button", { name: "Pause (Esc / P)" }),
  ).toBeVisible();
  const source = await canvas.evaluate((element: HTMLCanvasElement) => {
    const context = element.getContext("2d")!;
    const data = context.getImageData(0, 0, element.width, element.height).data;
    let painted = 0;
    const colors = new Set<number>();
    for (let index = 0; index < data.length; index += 4) {
      if (data[index] || data[index + 1] || data[index + 2]) painted++;
      colors.add(
        (data[index] << 16) | (data[index + 1] << 8) | data[index + 2],
      );
    }
    return {
      fraction: painted / (data.length / 4),
      colors: colors.size,
      width: element.width,
      height: element.height,
      png: element.toDataURL("image/png").split(",")[1],
    };
  });
  expect(source).toMatchObject({ width: 1620, height: 1080 });
  expect(source.fraction).toBeGreaterThan(0.8);
  expect(source.colors).toBeGreaterThan(100);
  // Headless Chromium can omit the desynchronized CPU canvas from composed
  // screenshots. Inspect its drawing buffer without changing production hints.
  await info.attach("snake-drawing-buffer.png", {
    body: Buffer.from(source.png, "base64"),
    contentType: "image/png",
  });
});

for (const slug of ["tetris", "asteroids", "prism-rush"]) {
  test(`${slug} plays, saves, and resumes through the console`, async ({
    page,
  }, info) => {
    await start(page, slug);
    await page.keyboard.press("ArrowLeft");
    if (slug !== "prism-rush") await page.keyboard.press("Space");
    await page.waitForTimeout(500);
    await captureScreenshot(page, {
      path: info.outputPath(`${slug}-playing.png`),
    });
    await pause(page);
    const state = await save(page, slug);
    expect(state.version).toBe(1);
    await page.goto(`/play/${slug}`);
    await page
      .getByRole("button", { name: "Continue saved run", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Paused", exact: true }),
    ).toBeVisible();
    const restored = await save(page, slug, 2);
    expect(restored).toEqual(state);
    await page.getByRole("button", { name: "Resume", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Pause (Esc / P)" }),
    ).toBeVisible();
    if (slug === "prism-rush") {
      await expect
        .poll(
          async () => {
            const text = await page
              .getByLabel("Prism Rush instruments")
              .textContent();
            return Number(text?.match(/·\s+(\d+)\s+m/)?.[1] ?? 0);
          },
          { timeout: 20000 },
        )
        .toBeGreaterThan(65);
      await captureScreenshot(page, {
        path: info.outputPath("prism-rush-gates.png"),
      });
    }
    await pause(page);
  });
}
