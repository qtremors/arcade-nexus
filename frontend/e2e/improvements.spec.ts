import { test as base, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const test = base.extend<{ profileId: number }>({
  profileId: async ({ request }, provide) => {
    const response = await request.post("/api/profiles", {
      data: {
        username: `Review-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
      },
    });
    expect(response.ok()).toBeTruthy();
    await provide((await response.json()).id);
  },
});
test.beforeEach(async ({ page, profileId }) => {
  await page.addInitScript((id) => {
    sessionStorage.setItem("arcade_nexus_session_booted", "true");
    sessionStorage.setItem("nexus-profile", String(id));
  }, profileId);
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

test("history sorts the entire result set and filters game, mode, difficulty and dates", async ({
  page,
  request,
  profileId,
}, info) => {
  for (let index = 0; index < 32; index++) {
    const response = await request.post("/api/progress/snake/complete", {
      headers: { "X-Profile-ID": String(profileId) },
      data: {
        session_id: crypto.randomUUID(),
        playtime_seconds: 5,
        score: index === 0 ? 9999 : index,
        difficulty: index % 2 ? "hard" : "normal",
        mode: index % 2 ? "sprint" : "classic",
      },
    });
    expect(response.ok()).toBeTruthy();
  }
  await page.goto("/progress");
  await page
    .getByRole("button", { name: "Session history", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Session history" });
  await expect(dialog.getByText("1–25 of 32", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Score", exact: true }).click();
  await expect(dialog.locator("tbody tr").first()).toContainText("9,999");
  await dialog.getByRole("button", { name: "Next page", exact: true }).click();
  await expect(dialog.getByText("26–32 of 32", { exact: true })).toBeVisible();
  await dialog
    .getByRole("combobox", { name: "Mode", exact: true })
    .selectOption("sprint");
  await expect(dialog.getByText("1–16 of 16", { exact: true })).toBeVisible();
  await dialog
    .getByRole("combobox", { name: "Difficulty", exact: true })
    .selectOption("normal");
  await expect(
    dialog.getByText("No completed sessions match these filters."),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Clear filters" }).click();
  await expect(dialog.getByText("1–25 of 32", { exact: true })).toBeVisible();
  await dialog
    .getByRole("combobox", { name: "Game", exact: true })
    .selectOption({ label: "Neon Snake" });
  await dialog.getByLabel("From", { exact: true }).fill("2099-01-01");
  await expect(
    dialog.getByText("No completed sessions match these filters."),
  ).toBeVisible();
  await page.screenshot({ path: info.outputPath("history-filters.png") });
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

test("automatic backup previews can be cancelled and restore copies without changing preferences", async ({
  page,
  request,
  profileId,
}) => {
  await page.goto("/settings");
  await page
    .locator("summary")
    .filter({ hasText: /^Automatic backups$/ })
    .click();
  await page
    .getByRole("button", { name: "Create backup now", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Restore copy", exact: true }).first(),
  ).toBeVisible();
  const before = (await (await request.get("/api/profiles")).json())
    .profiles as { id: number }[];
  await page
    .getByRole("button", { name: "Restore copy", exact: true })
    .first()
    .click();
  const preview = page.getByRole("alertdialog", {
    name: "Restore automatic backup?",
  });
  await expect(preview).toContainText(`${before.length} player copies`);
  expect(
    (await (await request.get("/api/profiles")).json()).profiles,
  ).toHaveLength(before.length);
  await preview.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(preview).toBeHidden();
  await page
    .getByRole("button", { name: "Restore copy", exact: true })
    .first()
    .click();
  await preview
    .getByRole("button", { name: "Restore player copies", exact: true })
    .click();
  await expect(
    page.getByText(`Restored ${before.length} players.`, { exact: true }),
  ).toBeVisible();
  const after = (await (await request.get("/api/profiles")).json())
    .profiles as { id: number }[];
  expect(after).toHaveLength(before.length * 2);
  expect(after.some((player) => player.id === profileId)).toBe(true);
  await expect(page.getByLabel("Mute sounds")).not.toBeChecked();
});

test("conflicting key bindings are rejected and a valid remap persists", async ({
  page,
}) => {
  await page.goto("/settings");
  await page.getByRole("button", { name: "up: Default", exact: true }).click();
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByText(/already used by left/)).toBeVisible();
  await page.keyboard.press("p");
  await expect(
    page.getByText("P is reserved for Pause. Choose a different key."),
  ).toBeVisible();
  await page.keyboard.press("i");
  await expect(
    page.getByRole("button", { name: "up: KeyI", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "up: KeyI", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Reset controls", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "up: Default", exact: true }),
  ).toBeVisible();
});

test("a created player stays usable when the following profile-list refresh fails", async ({
  page,
}) => {
  let lists = 0;
  await page.route("**/api/profiles", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    lists++;
    await route.fulfill({
      status: lists === 1 ? 200 : 503,
      json:
        lists === 1
          ? { profiles: [], active_id: null }
          : { detail: "Refresh unavailable" },
    });
  });
  await page.goto("/home");
  await expect(
    page.getByRole("heading", { name: "Create your player" }),
  ).toBeVisible();
  const name = `Created-${Date.now()}`;
  await page.getByLabel("Player name", { exact: true }).fill(name);
  await page
    .getByRole("button", { name: "Create player", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: `Good to see you, ${name}.` }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Your player profile" }).click();
  await expect(
    page.getByRole("heading", { name: "Player profile" }),
  ).toBeVisible();
  await expect(page.locator(".profile-summary")).toContainText(name);
});

test("the profile overview loads counts without fetching unused session or achievement rows", async ({
  page,
  request,
  profileId,
}) => {
  await request.post("/api/progress/snake/complete", {
    headers: { "X-Profile-ID": String(profileId) },
    data: { session_id: crypto.randomUUID(), playtime_seconds: 5, score: 1 },
  });
  const reads: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "GET") reads.push(new URL(request.url()).pathname);
  });
  const summary = page.waitForResponse((response) =>
    response.url().endsWith("/api/achievements/summary"),
  );
  await page.goto("/profile");
  await summary;
  await expect(
    page.getByText("Sessions", { exact: true }).locator(".."),
  ).toContainText("1");
  expect(reads).not.toContain("/api/stats/sessions");
  expect(reads).not.toContain("/api/achievements");
  await page
    .getByRole("button", { name: "Session history", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Recent sessions" }),
  ).toContainText("1–1 of 1");
  expect(reads).toContain("/api/progress/history");
});

test("console pages meet automated accessibility checks at desktop and 200-percent-equivalent layout", async ({
  page,
}, info) => {
  test.setTimeout(180000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const failures: unknown[] = [];
  for (const width of [1440, 720]) {
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 450 });
    for (const path of [
      "/home",
      "/games",
      "/favorites",
      "/progress",
      "/profile",
      "/settings",
    ]) {
      await page.goto(path);
      await expect(
        page.getByRole("heading", { level: 1 }).first(),
      ).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      const result = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      for (const violation of result.violations)
        failures.push({
          path,
          width,
          id: violation.id,
          nodes: violation.nodes.map((node) => ({
            target: node.target,
            summary: node.failureSummary,
          })),
        });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        path,
      ).toBe(true);
    }
  }
  await page
    .getByRole("button", { name: "Export backup", exact: true })
    .scrollIntoViewIfNeeded();
  await expect(
    page.getByRole("button", { name: "Export backup", exact: true }),
  ).toBeInViewport();
  await page.screenshot({
    path: info.outputPath("settings-zoom-equivalent.png"),
  });
  await info.attach("accessibility-findings.json", {
    body: JSON.stringify(failures, null, 2),
    contentType: "application/json",
  });
  expect(failures).toEqual([]);
});

test("storage quota failures keep settings usable, explain persistence, and export live preferences", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/settings");
  await page.evaluate(() => {
    const write = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "nexus-preferences")
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      return write.call(this, key, value);
    };
  });
  await page.getByLabel("Mute sounds").check();
  await expect(
    page.getByText(/Preferences are working for this visit/),
  ).toBeVisible();
  await expect(page.getByLabel("Mute sounds")).toBeChecked();
  const muted = await page.evaluate(async () => {
    const path = "/src/services/backup.ts";
    const { createBackup } = await import(path);
    const backup = await createBackup();
    return JSON.parse(backup.browser["nexus-preferences"]).state.muted;
  });
  expect(muted).toBe(true);
  expect(errors).toEqual([]);
});

test("controller focus follows open settings controls and can reach disclosure summaries", async ({
  page,
}) => {
  await page.goto("/settings");
  await expect(page.locator("main summary").first()).toBeVisible();
  const result = await page.evaluate(async () => {
    const path = "/src/sdk/menuNavigation.ts";
    const { moveMenuFocus } = await import(path);
    const summary = document.querySelector<HTMLElement>("main summary")!;
    summary.focus();
    moveMenuFocus("Down");
    const next = document.activeElement as HTMLElement;
    const closed = next.closest("details:not([open])");
    moveMenuFocus("Up");
    return {
      nextTag: next.tagName,
      trappedInClosedDetails: !!closed,
      returnedToSummary: document.activeElement === summary,
    };
  });
  expect(result.trappedInClosedDetails).toBe(false);
  expect(["INPUT", "BUTTON"]).toContain(result.nextTag);
  expect(result.returnedToSummary).toBe(true);
});

test("reduced motion finishes loading animations instead of looping rapidly", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/games**", (route) =>
    route.fulfill({ json: { games: [], total: 0 } }),
  );
  await page.goto("/settings");
  await expect(
    page.getByRole("heading", { name: "Settings", exact: true }),
  ).toBeVisible();
  for (const preference of ["system", "console"] as const) {
    if (preference === "console") {
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await page.getByLabel("Reduce animations").check();
    }
    await page.evaluate(() => {
      const loading = document.createElement("div");
      loading.className = "card-skeleton";
      loading.id = "motion-probe";
      loading.innerHTML = "<div></div>";
      document.querySelector("main")!.append(loading);
    });
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document
              .querySelector("#motion-probe > div")!
              .getAnimations()
              .filter((animation) => animation.playState === "running").length,
        ),
      )
      .toBe(0);
    await page.locator("#motion-probe").evaluate((element) => element.remove());
  }
});
