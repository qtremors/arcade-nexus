import { test as base, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
const test = base.extend<{ profileId: number }>({
  profileId: async ({ request }, provide, info) => {
    const response = await request.post("/api/profiles", {
      data: {
        username: `Browser-${Date.now()}-${info.workerIndex}`,
        avatar: "🎮",
      },
    });
    expect(response.ok()).toBeTruthy();
    const profile = (await response.json()) as { id: number };
    await provide(profile.id);
  },
});
let errors: string[] = [];
test.beforeEach(async ({ page, profileId }) => {
  errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript((id) => {
    sessionStorage.setItem("arcade_nexus_session_booted", "true");
    sessionStorage.setItem("nexus-profile", String(id));
  }, profileId);
});
test.afterEach(() => expect(errors).toEqual([]));
const start = async (page: Page, slug: string) => {
  await page.goto(`/play/${slug}`);
  await page.getByRole("button", { name: "Start game", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Pause (Esc / P)" }),
  ).toBeVisible();
};
const pause = async (page: Page) => {
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("heading", { name: "Paused", exact: true }),
  ).toBeVisible();
};
const save = async (page: Page, slug: string, slot = 1) => {
  await page.getByRole("button", { name: "Save game", exact: true }).click();
  const [response] = await Promise.all([
    page.waitForResponse(
      (r) =>
        r.url().endsWith(`/api/saves/${slug}`) &&
        r.request().method() === "POST",
    ),
    page.getByRole("button", { name: new RegExp(`^Slot ${slot} ·`) }).click(),
  ]);
  expect(response.ok()).toBeTruthy();
  const record = (await response.json()) as {
    data: { state: Record<string, unknown> };
  };
  await page.getByRole("button", { name: "Back", exact: true }).click();
  return record.data.state;
};
test("store search, library changes, settings, and profile switching work", async ({
  page,
  profileId,
  request,
}) => {
  await page.goto("/store");
  await page.getByLabel("Search store games").fill("Breakout");
  await expect(
    page.getByRole("button", { name: "Add to library Neon Breakout" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add to library Neon Snake" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Add to library Neon Breakout" })
    .click();
  await expect(
    page.getByRole("button", { name: "Play Neon Breakout" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Library", exact: true }).click();
  await page.getByLabel("Search library games").fill("snake");
  await expect(
    page.getByRole("button", { name: "PLAY Neon Breakout" }),
  ).toHaveCount(0);
  await page.getByLabel("Search library games").fill("");
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
  await expect(page.getByText("Library Empty")).toBeVisible();
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
    await page.screenshot({ path: info.outputPath(`${slug}.png`) });
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
test("Stellar Flight loads WebGL, accelerates, changes maps, and saves", async ({
  page,
  request,
  profileId,
}, info) => {
  await start(page, "stellar-flight");
  await page.keyboard.press("ArrowUp", { delay: 300 });
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
  await page.screenshot({ path: info.outputPath("flight-earth.png") });
  await page.keyboard.press("Digit2", { delay: 100 });
  await expect(page.locator(".flight-hud")).toContainText("Mars");
  await page.keyboard.press("Digit3", { delay: 100 });
  await expect(page.locator(".flight-hud")).toContainText("Space");
  await page.screenshot({ path: info.outputPath("flight.png") });
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
test("failed result submissions survive reload and replay only once", async ({
  page,
  request,
  profileId,
}) => {
  await page.route("**/api/stats/**/session", (route) => route.abort());
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
  await page.unroute("**/api/stats/**/session");
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

test("primary menu focus and 2048 undo work through normal keyboard controls", async ({
  page,
}, info) => {
  await page.goto("/play/breakout");
  await expect(
    page.getByRole("button", { name: "Start game", exact: true }),
  ).toBeFocused();
  await page.screenshot({ path: info.outputPath("launch.png") });
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", { name: "Pause (Esc / P)" }),
  ).toBeVisible();
  await pause(page);
  await expect(
    page.getByRole("button", { name: "Resume", exact: true }),
  ).toBeFocused();
  await page.screenshot({ path: info.outputPath("pause.png") });
  const controls = page.locator(".pause-controls summary");
  await controls.focus();
  await controls.press("Enter");
  await expect(page.locator(".pause-controls")).toHaveAttribute("open", "");
  await controls.press("Tab");
  await expect(
    page.getByRole("button", { name: "Resume", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Quit to console" }).click();
  await start(page, "merge-2048");
  await pause(page);
  const original = await save(page, "merge-2048");
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  for (const key of ["ArrowLeft", "ArrowDown", "ArrowRight"])
    await page.keyboard.press(key, { delay: 100 });
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await pause(page);
  const after = await save(page, "merge-2048");
  expect(after.undo).not.toBeNull();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await page.keyboard.press("KeyZ", { delay: 100 });
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await pause(page);
  const undone = await save(page, "merge-2048");
  expect(undone.board).toEqual((after.undo as { board: number[] }).board);
  expect(undone.score).toEqual((after.undo as { score: number }).score);
  expect(undone.undo).toBeNull();
  expect(original.undo).toBeNull();
});

test("Flight's course clears an actual gate and restores course progress", async ({
  page,
}, info) => {
  await start(page, "stellar-flight");
  await page.keyboard.down("ShiftLeft");
  await expect(page.locator(".flight-hud")).toContainText("Gates 1 cleared", {
    timeout: 20000,
  });
  await page.keyboard.up("ShiftLeft");
  await page.screenshot({ path: info.outputPath("flight-course.png") });
  await pause(page);
  const before = await save(page, "stellar-flight");
  expect(before.gatesPassed).toBe(1);
  expect(before.gate).not.toBeNull();
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

test("controller actions cross menus and gameplay without leaking confirm or pause", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const pad = {
      connected: true,
      index: 0,
      id: "Browser test pad",
      mapping: "standard",
      axes: [0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
    };
    Object.defineProperty(navigator, "getGamepads", { value: () => [pad] });
  });
  const press = async (id: number) => {
    await page.evaluate((id) => {
      (
        navigator.getGamepads()[0]!.buttons as unknown as { pressed: boolean }[]
      )[id].pressed = true;
    }, id);
    await page.waitForTimeout(180);
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    await page.evaluate((id) => {
      (
        navigator.getGamepads()[0]!.buttons as unknown as { pressed: boolean }[]
      )[id].pressed = false;
    }, id);
    await page.waitForTimeout(80);
  };
  await page.goto("/settings");
  const slider = page.getByRole("slider");
  await slider.focus();
  await press(15);
  await expect(slider).toHaveValue("55");
  const mute = page.getByLabel("Mute sounds");
  await press(13);
  await expect(mute).toBeFocused();
  await press(0);
  await expect(mute).toBeChecked();
  await press(5);
  await expect(page).toHaveURL(/\/store$/);
  await page.goto("/play/breakout");
  await expect(
    page.getByRole("button", { name: "Start game", exact: true }),
  ).toBeFocused();
  await press(0);
  await expect(
    page.getByRole("button", { name: "Pause (Esc / P)" }),
  ).toBeVisible();
  await press(9);
  await expect(
    page.getByRole("heading", { name: "Paused", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("dialog", { name: "System menu" })).toHaveCount(
    0,
  );
  const before = await save(page, "breakout");
  expect(before.launched).toBe(false);
  await press(0);
  await expect(
    page.getByRole("button", { name: "Pause (Esc / P)" }),
  ).toBeVisible();
  await press(0);
  await press(9);
  const after = await save(page, "breakout");
  expect(after.launched).toBe(true);
  await page.getByRole("button", { name: "Load game", exact: true }).click();
  await page.getByRole("button", { name: "Delete slot 1" }).click();
  await expect(
    page.getByRole("alertdialog", { name: "Delete slot 1?" }),
  ).toBeVisible();
  await press(1);
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Slot 1 ·/ })).toBeEnabled();
});

test("featured shelf, catalog empty states, and controller guide are usable", async ({
  page,
}, info) => {
  await page.goto("/home");
  await page
    .getByRole("button", { name: "Select Neon Snake", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Start Neon Snake", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("button", { name: "Select Raptor Run", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({ path: info.outputPath("oled-home.png") });
  await page.getByRole("link", { name: "Store", exact: true }).click();
  await page.getByLabel("Search store games").fill("no-such-title");
  await expect(
    page.getByRole("heading", { name: "No games found" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Add to library Neon Snake" }),
  ).toBeVisible();
  await page.getByLabel("Game category").selectOption("puzzle");
  await expect(
    page.getByRole("button", { name: "Add to library Merge 2048" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add to library Neon Snake" }),
  ).toHaveCount(0);
  await page.goto("/play/breakout");
  await page.getByRole("button", { name: "Controller", exact: true }).click();
  await expect(page.locator(".control-guide")).toContainText(
    "D-pad / left stick",
  );
  await expect(page.locator(".control-guide")).toContainText("Start");
  await page.getByRole("button", { name: "Keyboard", exact: true }).click();
  await expect(page.locator(".control-guide")).toContainText("Space");
  await page.screenshot({ path: info.outputPath("oled-launch.png") });
});

test("catalog errors recover and desktop windows keep actions visible", async ({
  page,
}) => {
  await page.route("**/api/games", (route) => route.abort());
  await page.goto("/store");
  await expect(
    page.getByRole("heading", { name: "Store unavailable" }),
  ).toBeVisible();
  await page.unroute("**/api/games");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Add to library Neon Snake" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add to library Neon Snake" }).click();
  await page.getByRole("link", { name: "Library", exact: true }).click();
  await page.getByLabel("Search library games").fill("no-such-title");
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
