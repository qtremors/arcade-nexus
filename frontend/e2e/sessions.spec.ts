import { captureScreenshot } from "./fixtures";
import { test, expect, start, pause, save } from "./fixtures";

test("failed result submissions survive reload and replay only once", async ({
  page,
  request,
  profileId,
}) => {
  await page.route("**/api/progress/**/complete", (route) => route.abort());
  await start(page, "merge-2048");
  await page.keyboard.press("ArrowRight", { delay: 100 });
  await pause(page);
  await page.getByRole("button", { name: "Quit to console" }).click();
  await expect(page.getByText(/Result saved for retry/)).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        Object.keys(localStorage).filter((k) =>
          k.startsWith("nexus-result-v1:"),
        ).length,
    ),
  ).toBe(1);
  await page.unroute("**/api/progress/**/complete");
  await page.goto("/settings");
  await page.getByRole("button", { name: "Retry pending results" }).click();
  await expect
    .poll(async () =>
      page.evaluate(
        () =>
          Object.keys(localStorage).filter((k) =>
            k.startsWith("nexus-result-v1:"),
          ).length,
      ),
    )
    .toBe(0);
  await page.reload();
  const history = (await (
    await request.get("/api/stats/sessions", {
      headers: { "X-Profile-ID": String(profileId) },
    })
  ).json()) as unknown[];
  expect(history).toHaveLength(1);
});

test("startup retry and unknown game routes have usable recovery", async ({
  page,
}) => {
  await page.route("**/api/profiles", (route) => route.abort());
  await page.goto("/");
  await expect(page.getByText("Console unavailable")).toBeVisible();
  await page.unroute("**/api/profiles");
  await page.getByRole("button", { name: "Retry Connection" }).click();
  await expect(page.getByText("Select Experience")).toBeVisible();
  await page.goto("/play/missing");
  await expect(page.getByText("Failed to load game")).toBeVisible();
  await page.getByRole("button", { name: "← Back to Console" }).click();
  await expect(page.getByText("Select Experience")).toBeVisible();
});

test("two browser tabs keep games attributed to their original players", async ({
  page,
  request,
  profileId,
}) => {
  await start(page, "snake");
  await pause(page);
  const secondProfile = (await (
    await request.post("/api/profiles", {
      data: { username: `Other-tab-${Date.now()}` },
    })
  ).json()) as { id: number };
  await request.post(`/api/profiles/${secondProfile.id}/activate`);
  const second = await page.context().newPage();
  await second.addInitScript((id) => {
    sessionStorage.setItem("arcade_nexus_session_booted", "true");
    sessionStorage.setItem("nexus-profile", String(id));
  }, secondProfile.id);
  await start(second, "raptor-run");
  await second.keyboard.press("Space", { delay: 100 });
  await pause(second);
  await second.getByRole("button", { name: "Quit to console" }).click();
  await expect(second.getByText("Select Experience")).toBeVisible();
  await second.close();
  await page.getByRole("button", { name: "Quit to console" }).click();
  await expect(page.getByText("Select Experience")).toBeVisible();
  const first = (await (
    await request.get("/api/stats/sessions", {
      headers: { "X-Profile-ID": String(profileId) },
    })
  ).json()) as { game_slug: string }[];
  const other = (await (
    await request.get("/api/stats/sessions", {
      headers: { "X-Profile-ID": String(secondProfile.id) },
    })
  ).json()) as { game_slug: string }[];
  expect(first.map((s) => s.game_slug)).toEqual(["snake"]);
  expect(other.map((s) => s.game_slug)).toEqual(["raptor-run"]);
});

test("restoring a cached document starts a fresh session when resumed", async ({
  page,
  request,
  profileId,
}) => {
  await start(page, "merge-2048");
  await page.keyboard.press("ArrowLeft", { delay: 100 });
  await page.evaluate(() => {
    window.dispatchEvent(
      new PageTransitionEvent("pagehide", { persisted: true }),
    );
    window.dispatchEvent(
      new PageTransitionEvent("pageshow", { persisted: true }),
    );
  });
  await expect(
    page.getByRole("heading", { name: "Paused", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Pause (Esc / P)" }),
  ).toBeVisible();
  await pause(page);
  await page.getByRole("button", { name: "Quit to console" }).click();
  await expect(page.getByText("Select Experience")).toBeVisible();
  await page.reload();
  await expect
    .poll(async () =>
      page.evaluate(
        () =>
          Object.keys(localStorage).filter((k) =>
            k.startsWith("nexus-result-v1:"),
          ).length,
      ),
    )
    .toBe(0);
  const history = (await (
    await request.get("/api/stats/sessions", {
      headers: { "X-Profile-ID": String(profileId) },
    })
  ).json()) as { session_id: string }[];
  expect(history).toHaveLength(2);
  expect(new Set(history.map((s) => s.session_id)).size).toBe(2);
});

test("terminal undo keeps the result uncommitted until the player finishes", async ({
  page,
  request,
  profileId,
}) => {
  const headers = { "X-Profile-ID": String(profileId) };
  await request.post("/api/saves/merge-2048", {
    headers,
    data: {
      slot: 1,
      data: {
        format: 2,
        game: "merge-2048",
        difficulty: "normal",
        mode: "classic",
        rules_version: 2,
        state: {
          version: 1,
          mode: "classic",
          score: 100,
          board: [
            2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2, 4, 8, 16, 32, 64,
          ],
          undo: { board: [2, 2, 0, 0, ...Array(12).fill(0)], score: 0 },
        },
      },
    },
  });
  await page.goto("/play/merge-2048");
  await page.getByRole("button", { name: "Load game", exact: true }).click();
  await page.getByRole("button", { name: /^Slot 1 ·/ }).click();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await page
    .getByRole("button", { name: "Undo last move", exact: true })
    .waitFor();
  expect(
    (await (await request.get("/api/progress/history", { headers })).json())
      .total,
  ).toBe(0);
  await page
    .getByRole("button", { name: "Undo last move", exact: true })
    .click();
  await pause(page);
  const restored = await save(page, "merge-2048");
  expect(restored.score).toBe(0);
  expect(restored.board).toEqual([2, 2, 0, 0, ...Array(12).fill(0)]);
  await page.getByRole("button", { name: "Quit to console" }).click();
  await expect(page).toHaveURL(/\/home$/);
  expect(
    (await (await request.get("/api/progress/history", { headers })).json())
      .total,
  ).toBe(1);
});

test("completed Tetris sprints show time records in results and progress", async ({
  page,
  request,
  profileId,
}, info) => {
  const headers = { "X-Profile-ID": String(profileId) };
  const board = Array.from({ length: 20 }, (_, y) =>
    Array.from({ length: 10 }, (_, x) => (y >= 16 && x !== 5 ? 2 : 0)),
  );
  await request.post("/api/saves/tetris", {
    headers,
    data: {
      slot: 1,
      data: {
        format: 2,
        game: "tetris",
        mode: "sprint",
        rules_version: 2,
        difficulty: "normal",
        state: {
          version: 1,
          mode: "sprint",
          difficulty: "normal",
          board,
          piece: 0,
          rotation: 1,
          x: 3,
          y: 0,
          queue: [1, 2, 3, 4, 5, 6, 0],
          held: null,
          canHold: true,
          score: 1000,
          lines: 36,
          elapsed: 85321,
          fall: 0,
          lock: 0,
          resets: 0,
          terminal: false,
          random: 42,
        },
      },
    },
  });
  await page.goto("/play/tetris");
  await page.getByRole("button", { name: "Load game", exact: true }).click();
  await page.getByRole("button", { name: /^Slot 1 ·/ }).click();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Pause (Esc / P)" }),
  ).toBeVisible();
  await page.keyboard.press("Space", { delay: 80 });
  await expect(
    page.getByRole("heading", { name: "Sprint complete" }),
  ).toBeVisible();
  await expect(
    page.getByText("NEW PERSONAL BEST", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/^Best: 1:/)).toBeVisible();
  await captureScreenshot(page, {
    path: info.outputPath("tetris-sprint-result.png"),
  });
  await page.goto("/progress");
  await expect(
    page.getByRole("cell", { name: /^1:2[5-9]\.\d{3}$/ }),
  ).toBeVisible();
});

test("Settings survives corrupted metrics and reconciles results completed in another tab", async ({
  page,
  request,
  profileId,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("nexus-performance", "null"),
  );
  await page.goto("/settings");
  await expect(
    page.getByRole("heading", { name: "Settings", exact: true }),
  ).toBeVisible();
  const sessionId = await page.evaluate(async (profileId) => {
    const module = "/src/services/sessionQueue.ts";
    const { enqueueCompletion } = await import(module);
    const sessionId = crypto.randomUUID();
    enqueueCompletion({
      slug: "snake",
      sessionId,
      profileId,
      seconds: 10,
      score: 50,
      difficulty: "normal",
      metrics: {},
      retryAt: Date.now() + 60000,
    });
    return sessionId;
  }, profileId);
  await expect(
    page.getByText("1 results awaiting sync", { exact: true }),
  ).toBeVisible();
  const other = await page.context().newPage();
  try {
    await other.goto("/health");
    const response = await other.request.post("/api/progress/snake/complete", {
      headers: { "X-Profile-ID": String(profileId) },
      data: {
        session_id: sessionId,
        playtime_seconds: 10,
        score: 50,
        difficulty: "normal",
        metrics: {},
      },
    });
    expect(response.ok()).toBeTruthy();
    await other.evaluate(
      (id) => localStorage.removeItem(`nexus-result-v1:${id}`),
      sessionId,
    );
    await expect(
      page.getByText("0 results awaiting sync", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Retry pending results" }),
    ).toBeDisabled();
    const history = await request.get("/api/progress/history", {
      headers: { "X-Profile-ID": String(profileId) },
    });
    expect((await history.json()).total).toBe(1);
  } finally {
    await other.close();
  }
});

test("two tabs coordinate retries with a shared browser lock", async ({
  page,
  request,
  profileId,
}) => {
  let requests = 0;
  await page
    .context()
    .route("**/api/progress/snake/complete", async (route) => {
      requests++;
      await new Promise((resolve) => setTimeout(resolve, 150));
      await route.continue();
    });
  const other = await page.context().newPage();
  try {
    await Promise.all([page.goto("/health"), other.goto("/health")]);
    await page.evaluate(async (profileId) => {
      const path = "/src/services/sessionQueue.ts";
      const queue = await import(path);
      queue.enqueueCompletion({
        slug: "snake",
        sessionId: crypto.randomUUID(),
        profileId,
        seconds: 10,
        score: 50,
        difficulty: "normal",
        metrics: {},
      });
    }, profileId);
    const flush = async () => {
      const path = "/src/services/sessionQueue.ts";
      await (await import(path)).flushCompletions(true);
    };
    await Promise.all([page.evaluate(flush), other.evaluate(flush)]);
    expect(requests).toBe(1);
    const history = await request.get("/api/progress/history", {
      headers: { "X-Profile-ID": String(profileId) },
    });
    expect((await history.json()).total).toBe(1);
  } finally {
    await other.close();
  }
});

test("connection checks are shared and hidden tabs stop background work", async ({
  page,
}) => {
  let checks = 0;
  await page.route("**/health", async (route) => {
    checks++;
    await route.continue();
  });
  await page.clock.install();
  await page.goto("/settings");
  await expect(
    page.getByRole("heading", { name: "Settings", exact: true }),
  ).toBeVisible();
  await page.clock.runFor(20);
  await expect(page.getByText(/^Connected ·/)).toBeVisible();
  expect(checks).toBe(1);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.clock.runFor(120000);
  expect(checks).toBe(1);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.clock.runFor(20);
  await expect.poll(() => checks).toBe(2);
});

test("recovery saves once on pause and sleeps until play resumes", async ({
  page,
}) => {
  let writes = 0;
  page.on("request", (request) => {
    if (
      request.method() === "PUT" &&
      request.url().endsWith("/api/progress/recovery/merge-2048")
    )
      writes++;
  });
  await page.clock.install();
  await page.goto("/play/merge-2048");
  await page.getByRole("button", { name: "Start game", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Pause (Esc / P)" }),
  ).toBeVisible();
  const periodic = page.waitForResponse(
    (response) =>
      response.request().method() === "PUT" &&
      response.url().endsWith("/api/progress/recovery/merge-2048"),
  );
  await page.clock.runFor(5100);
  await periodic;
  const pauseSave = page.waitForResponse(
    (response) =>
      response.request().method() === "PUT" &&
      response.url().endsWith("/api/progress/recovery/merge-2048"),
  );
  await page.getByRole("button", { name: "Pause (Esc / P)" }).click();
  await pauseSave;
  await expect(
    page.getByRole("heading", { name: "Paused", exact: true }),
  ).toBeVisible();
  const pausedWrites = writes;
  await page.clock.runFor(15000);
  expect(writes).toBe(pausedWrites);
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  const resumedSave = page.waitForResponse(
    (response) =>
      response.request().method() === "PUT" &&
      response.url().endsWith("/api/progress/recovery/merge-2048"),
  );
  await page.clock.runFor(5100);
  await resumedSave;
  expect(writes).toBeGreaterThan(pausedWrites);
});
