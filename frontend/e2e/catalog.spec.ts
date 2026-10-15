import { captureScreenshot } from "./fixtures";
import { test, expect, start, pause, save } from "./fixtures";

test("store search, library changes, settings, and profile switching work", async ({
  page,
  profileId,
  request,
}) => {
  await page.goto("/store");
  await page.getByLabel("Search games").fill("Breakout");
  await expect(
    page.getByRole("button", { name: "Favorite Neon Breakout" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Favorite Neon Snake" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Favorite Neon Breakout" }).click();
  await expect(
    page.getByRole("button", { name: "Play Neon Breakout" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Favorites", exact: true }).click();
  await page.getByLabel("Search favorites").fill("snake");
  await expect(
    page.getByRole("button", { name: "PLAY Neon Breakout" }),
  ).toHaveCount(0);
  await page.getByLabel("Search favorites").fill("");
  await expect(
    page.getByRole("button", { name: "PLAY Neon Breakout" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Remove Neon Breakout" }).click();
  await expect(
    page.getByRole("alertdialog", { name: "Remove this game?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "PLAY Neon Breakout" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Remove Neon Breakout" }).click();
  await page.getByRole("button", { name: "Remove game", exact: true }).click();
  await expect(page.getByText("No favorites yet")).toBeVisible();
  await page.getByRole("button", { name: "Open system menu" }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "System menu" })).toHaveCount(
    0,
  );
  await page.getByLabel("Mute sounds").check();
  await page.reload();
  await expect(page.getByLabel("Mute sounds")).toBeChecked();
  await page.goto("/profile");
  await expect(page.getByText("Switch player", { exact: true })).toBeVisible();
  await page.getByLabel("New player name").fill(`Second-${Date.now()}`);
  await page
    .getByRole("button", { name: "Create player", exact: true })
    .click();
  await expect
    .poll(async () =>
      page.evaluate(() => Number(sessionStorage.getItem("nexus-profile"))),
    )
    .not.toBe(profileId);
  const profiles = (await (await request.get("/api/profiles")).json()) as {
    profiles: { id: number; username: string }[];
  };
  const original = profiles.profiles.find((p) => p.id === profileId)!;
  await page
    .getByRole("button", { name: `🎮 ${original.username}`, exact: true })
    .click();
  await expect
    .poll(async () =>
      page.evaluate(() => Number(sessionStorage.getItem("nexus-profile"))),
    )
    .toBe(profileId);
});

test("2048 restores complete saves after returning to the console", async ({
  page,
  request,
  profileId,
}) => {
  await start(page, "merge-2048");
  for (const code of [
    "ArrowLeft",
    "ArrowDown",
    "ArrowRight",
    "ArrowUp",
    "ArrowLeft",
    "ArrowDown",
  ])
    await page.keyboard.press(code, { delay: 70 });
  await pause(page);
  const original = await save(page, "merge-2048");
  await page.getByRole("button", { name: "Quit to console" }).click();
  await expect(page.getByText("Select Experience")).toBeVisible();
  await page.goto("/play/merge-2048");
  await page.getByRole("button", { name: "Load game", exact: true }).click();
  await page.getByRole("button", { name: /^Slot 1 ·/ }).click();
  await expect(
    page.getByRole("heading", { name: "Paused", exact: true }),
  ).toBeVisible();
  const restored = await save(page, "merge-2048", 2);
  expect(restored).toEqual(original);
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Pause (Esc / P)" }),
  ).toBeVisible();
  await pause(page);
  await page.getByRole("button", { name: "Quit to console" }).click();
  await expect(page.getByText("Select Experience")).toBeVisible();
  const history = (await (
    await request.get("/api/stats/sessions", {
      headers: { "X-Profile-ID": String(profileId) },
    })
  ).json()) as { session_id: string; score: number }[];
  expect(history).toHaveLength(2);
  expect(new Set(history.map((s) => s.session_id)).size).toBe(2);
});

test("Endless Flight clears a real ring and restores its full journey", async ({
  page,
}, info) => {
  await start(page, "stellar-flight");
  await page.keyboard.down("ShiftLeft");
  await expect(page.locator(".flight-hud")).toContainText("Gates 1 cleared", {
    timeout: 20000,
  });
  await page.keyboard.up("ShiftLeft");
  await captureScreenshot(page, { path: info.outputPath("flight-race.png") });
  await pause(page);
  const before = await save(page, "stellar-flight");
  expect(Number(before.gatesPassed)).toBeGreaterThanOrEqual(1);
  expect(before.gates).toHaveLength(5);
  expect(Number(before.xp)).toBeGreaterThan(0);
  expect(before.mode).toBe("endless");
  await page.getByRole("button", { name: "Quit to console" }).click();
  await page.getByText("Select Experience").waitFor();
  await page.goto("/play/stellar-flight");
  await page.getByRole("button", { name: "Load game", exact: true }).click();
  await page.getByRole("button", { name: /^Slot 1 ·/ }).click();
  await expect(
    page.getByRole("heading", { name: "Paused", exact: true }),
  ).toBeVisible();
  const restored = await save(page, "stellar-flight");
  expect(restored).toEqual(before);
});

test("Flight surveys a real beacon, restores its camera, and fits a narrow viewport", async ({
  page,
}, info) => {
  await start(page, "stellar-flight");
  const playfield = await page
    .getByLabel("Stellar Flight playfield")
    .boundingBox();
  expect(playfield!.width).toBeGreaterThan(1400);
  await page.keyboard.press("KeyN");
  await expect(page.locator(".space-race-heading")).toContainText("SURVEY");
  await page.keyboard.press("KeyW", { delay: 200 });
  await page.keyboard.down("ShiftLeft");
  await expect(page.locator(".space-location-detail")).toContainText(
    "1 surveyed",
    { timeout: 20000 },
  );
  await page.keyboard.up("ShiftLeft");
  await page.keyboard.press("KeyC");
  await expect(page.locator(".flight-hud")).toHaveAttribute(
    "data-camera",
    "nose",
  );
  await captureScreenshot(page, {
    path: info.outputPath("flight-survey-nose.png"),
  });
  await pause(page);
  const before = await save(page, "stellar-flight");
  expect(before.navigation).toBe("explore");
  expect(before.cameraView).toBe("nose");
  expect(before.scanned).toHaveLength(1);
  await page.getByRole("button", { name: "Restart", exact: true }).click();
  await expect(
    page.getByRole("alertdialog", { name: "Start a new journey?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Quit to console" }).click();
  await page.getByText("Select Experience").waitFor();
  await page.goto("/play/stellar-flight");
  await page.getByRole("button", { name: "Load game", exact: true }).click();
  await page.getByRole("button", { name: /^Slot 1 ·/ }).click();
  const restored = await save(page, "stellar-flight");
  expect(restored).toEqual(before);
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Pause (Esc / P)" }),
  ).toBeVisible();
  await page.keyboard.press("KeyC");
  await expect(page.locator(".flight-hud")).toHaveAttribute(
    "data-camera",
    "wide",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  const viewport = await page
    .getByLabel("Stellar Flight playfield")
    .boundingBox();
  expect(viewport!.width).toBe(390);
  expect(viewport!.height).toBe(844);
  await expect
    .poll(async () =>
      page.getByLabel("Stellar Flight playfield").evaluate((node) => {
        const canvas = node as HTMLCanvasElement;
        return Math.abs(canvas.width / canvas.height - 390 / 844);
      }),
    )
    .toBeLessThan(0.01);
  await expect(page.locator(".space-race-heading")).toBeVisible();
  await captureScreenshot(page, { path: info.outputPath("flight-narrow.png") });
});

test("catalog errors recover and desktop windows keep actions visible", async ({
  page,
}) => {
  await page.route("**/api/games", (route) => route.abort());
  await page.goto("/store");
  await expect(
    page.getByRole("heading", { name: "Games unavailable" }),
  ).toBeVisible();
  await page.unroute("**/api/games");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Favorite Neon Snake" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Favorite Neon Snake" }).click();
  await page.getByRole("link", { name: "Favorites", exact: true }).click();
  await page.getByLabel("Search favorites").fill("no-such-title");
  await expect(
    page.getByRole("heading", { name: "No matching games" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear search", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "PLAY Neon Snake" }),
  ).toBeVisible();
  for (const width of [1440, 1280, 1024, 800]) {
    await page.setViewportSize({ width, height: 720 });
    await expect(
      page.getByRole("link", { name: "Home", exact: true }),
    ).toBeVisible();
    const overflow = await page
      .locator(".console-page")
      .evaluate((element) => element.scrollWidth > element.clientWidth);
    expect(overflow).toBe(false);
  }
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await expect(page.getByRole("button", { name: /^Start / })).toBeVisible();
});

test("automatic recovery survives losing the page and Continue restores the board", async ({
  page,
  profileId,
}, info) => {
  await start(page, "merge-2048");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  await pause(page);
  const before = await page.evaluate(
    () =>
      JSON.parse(
        Object.entries(localStorage).find(
          ([key]) =>
            key.startsWith("nexus-recovery-v2:") && key.endsWith(":merge-2048"),
        )![1],
      ).state,
  );
  const context = page.context();
  await page.close();
  const reopened = await context.newPage();
  await reopened.addInitScript((id) => {
    sessionStorage.setItem("arcade_nexus_session_booted", "true");
    sessionStorage.setItem("nexus-profile", String(id));
  }, profileId);
  await reopened.goto("/home");
  await reopened.getByRole("link", { name: /Merge 2048.*Continue/ }).click();
  await expect(
    reopened.getByRole("heading", { name: "Paused", exact: true }),
  ).toBeVisible();
  expect(await save(reopened, "merge-2048")).toEqual(before);
  await captureScreenshot(reopened, {
    path: info.outputPath("continue-restored.png"),
  });
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
