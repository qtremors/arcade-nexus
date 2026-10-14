import { test as base, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
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
  await expect(
    page.getByRole("button", { name: "Pause (Esc / P)" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("heading", { name: "Paused", exact: true }),
  ).toBeVisible();
};
const save = async (page: Page, slug: string, slot = 1) => {
  await page.getByRole("button", { name: "Save game", exact: true }).click();
  const responsePromise = page.waitForResponse(
    (r) =>
      r.url().endsWith(`/api/saves/${slug}`) && r.request().method() === "POST",
  );
  const slotButton = page.getByRole("button", {
    name: new RegExp(`^Slot ${slot} ·`),
  });
  const occupied = !(await slotButton.textContent())?.includes("Empty");
  await slotButton.click();
  if (occupied)
    await page
      .getByRole("button", { name: "Replace save", exact: true })
      .click();
  const response = await responsePromise;
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
  await page.screenshot({ path: info.outputPath("flight-dart.png") });
  await page.keyboard.press("KeyV", { delay: 100 });
  await expect(page.locator(".flight-hud")).toContainText("Legacy Jet");
  await page.keyboard.press("KeyM", { delay: 100 });
  await expect(page.locator(".flight-hud")).toContainText(
    "New race plotted ahead",
  );
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

test("Endless Flight clears a real ring and restores its full journey", async ({
  page,
}, info) => {
  await start(page, "stellar-flight");
  await page.keyboard.down("ShiftLeft");
  await expect(page.locator(".flight-hud")).toContainText("Gates 1 cleared", {
    timeout: 20000,
  });
  await page.keyboard.up("ShiftLeft");
  await page.screenshot({ path: info.outputPath("flight-race.png") });
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
    await page.screenshot({ path: info.outputPath(`ship-${id}.png`) });
    await page.keyboard.press("KeyV", { delay: 100 });
  }
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
  await page.screenshot({ path: info.outputPath("flight-survey-nose.png") });
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
  await page.screenshot({ path: info.outputPath("flight-narrow.png") });
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
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    await page.waitForTimeout(80);
  };
  await page.goto("/settings");
  const slider = page.getByRole("slider", { name: /Sound volume/ });
  await slider.focus();
  await press(15);
  await expect(slider).toHaveValue("55");
  const mute = page.getByLabel("Mute sounds");
  await press(13);
  await expect(mute).toBeFocused();
  await press(0);
  await expect(mute).toBeChecked();
  await press(5);
  await expect(page).toHaveURL(/\/games$/);
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
  const shelf = page.locator(".shelf-game");
  const selectedIndex = await shelf.evaluateAll((nodes) =>
    nodes.findIndex((node) => node.getAttribute("aria-pressed") === "true"),
  );
  const nextGame = shelf.nth((selectedIndex + 1) % (await shelf.count()));
  await page.keyboard.press("ArrowRight");
  await expect(nextGame).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({ path: info.outputPath("oled-home.png") });
  await page.getByRole("link", { name: "Games", exact: true }).click();
  await page.getByLabel("Search games").fill("no-such-title");
  await expect(
    page.getByRole("heading", { name: "No games found" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Favorite Neon Snake" }),
  ).toBeVisible();
  await page.getByLabel("Game category").selectOption("puzzle");
  await expect(
    page.getByRole("button", { name: "Favorite Merge 2048" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Favorite Neon Snake" }),
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
  await reopened.screenshot({ path: info.outputPath("continue-restored.png") });
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
test("backup download and restore preserve players and browser preferences", async ({
  page,
  request,
  profileId,
}, info) => {
  await start(page, "merge-2048");
  await pause(page);
  await save(page, "merge-2048");
  await page.getByRole("button", { name: "Quit to console" }).click();
  await expect(page).toHaveURL(/\/home$/);
  await page.goto("/settings");
  await page.getByLabel("Mute sounds").check();
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export backup", exact: true })
    .click();
  const download = await downloadPromise;
  const file = info.outputPath("backup.json");
  await download.saveAs(file);
  await page.getByLabel("Mute sounds").uncheck();
  await page.locator('input[type="file"]').setInputFiles(file);
  await page
    .getByRole("button", { name: "Restore backup", exact: true })
    .click();
  await expect(page.getByLabel("Mute sounds")).toBeChecked();
  const players = (await (await request.get("/api/profiles")).json())
    .profiles as { id: number; username: string }[];
  const original = players.find((p) => p.id === profileId)!;
  const copy = players.find(
    (p) =>
      p.id !== profileId &&
      p.username.startsWith(original.username.slice(0, 32)) &&
      p.username.includes("restored"),
  )!;
  expect(copy).toBeDefined();
  const headers = { "X-Profile-ID": String(copy.id) };
  expect(
    (await (await request.get("/api/saves/merge-2048", { headers })).json())
      .total,
  ).toBe(1);
  expect(
    (await (await request.get("/api/progress/history", { headers })).json())
      .total,
  ).toBe(1);
});
test("controller text entry and disconnect pause work", async ({ page }) => {
  await page.addInitScript(() => {
    const pad = {
      connected: true,
      index: 0,
      id: "Text test",
      mapping: "standard",
      axes: [0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
    };
    Object.defineProperty(navigator, "getGamepads", { value: () => [pad] });
  });
  const press = async (id: number) => {
    await page.evaluate((id) => {
      (
        navigator.getGamepads()[0]!.buttons[id] as unknown as {
          pressed: boolean;
        }
      ).pressed = true;
    }, id);
    await page.waitForTimeout(100);
    await page.evaluate((id) => {
      (
        navigator.getGamepads()[0]!.buttons[id] as unknown as {
          pressed: boolean;
        }
      ).pressed = false;
    }, id);
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    await page.waitForTimeout(80);
  };
  await page.goto("/games");
  await page.getByLabel("Search games").focus();
  await press(0);
  const keyboard = page.getByRole("dialog", { name: "Controller keyboard" });
  await expect(keyboard).toBeVisible();
  await keyboard.getByRole("button", { name: "S", exact: true }).focus();
  await press(0);
  await keyboard.getByRole("button", { name: "Done", exact: true }).focus();
  await press(0);
  await expect(page.getByLabel("Search games")).toHaveValue("S");
  await start(page, "breakout");
  await page.evaluate(() => {
    (
      navigator.getGamepads()[0] as unknown as { connected: boolean }
    ).connected = false;
  });
  await expect(
    page.getByRole("heading", { name: "Paused", exact: true }),
  ).toBeVisible();
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
      await page.screenshot({ path: info.outputPath("flight-migrated.png") });
      continue;
    }
    await expect(page.getByText("GOLD MEDAL", { exact: true })).toBeVisible();
    await expect(page.getByLabel("New achievements")).toBeVisible();
    await page.screenshot({ path: info.outputPath(`${slug}-complete.png`) });
    const history = (
      await (await request.get("/api/progress/history", { headers })).json()
    ).sessions;
    expect(
      history.find((s: { game_slug: string }) => s.game_slug === slug).metrics
        .completed,
    ).toBe(true);
  }
});

for (const slug of ["tetris", "asteroids", "prism-rush"]) {
  test(`${slug} plays, saves, and resumes through the console`, async ({
    page,
  }, info) => {
    await start(page, slug);
    await page.keyboard.press("ArrowLeft");
    if (slug !== "prism-rush") await page.keyboard.press("Space");
    await page.waitForTimeout(500);
    await page.screenshot({ path: info.outputPath(`${slug}-playing.png`) });
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
      await page.screenshot({ path: info.outputPath("prism-rush-gates.png") });
    }
    await pause(page);
  });
}

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
  await page.screenshot({ path: info.outputPath("2048-reader.png") });
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
  await page.screenshot({ path: info.outputPath("breakout-arcade.png") });
  await pause(page);
  await start(page, "stellar-flight");
  await expect(page.locator(".flight-hud")).toContainText("Race rings");
  await page.keyboard.press("KeyH", { delay: 80 });
  await expect(page.locator(".flight-hud")).toContainText("Chart new sectors");
  await page.keyboard.press("KeyN", { delay: 80 });
  await expect(page.locator(".flight-hud")).toContainText("SURVEY");
  await page.screenshot({
    path: info.outputPath("flight-contract-survey.png"),
  });
  await pause(page);
  const flight = await save(page, "stellar-flight");
  expect(flight.contractChoice).toBe(1);
  expect(flight.navigation).toBe("explore");
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
  await page.screenshot({ path: info.outputPath("tetris-sprint-result.png") });
  await page.goto("/progress");
  await expect(
    page.getByRole("cell", { name: /^1:2[5-9]\.\d{3}$/ }),
  ).toBeVisible();
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

test("backup export includes results held only in memory after storage quota failures", async ({
  page,
  profileId,
}, info) => {
  await page.goto("/settings");
  await expect(
    page.getByRole("heading", { name: "Settings", exact: true }),
  ).toBeVisible();
  const item = await page.evaluate(async (profileId) => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith("nexus-result-v1:"))
        throw new DOMException("Full", "QuotaExceededError");
      return original.call(this, key, value);
    };
    const module = "/src/services/sessionQueue.ts";
    const { enqueueCompletion } = await import(module);
    const item = {
      slug: "snake",
      sessionId: crypto.randomUUID(),
      profileId,
      seconds: 10,
      score: 777,
      difficulty: "normal",
      metrics: {},
      blocked: true,
    };
    if (enqueueCompletion(item))
      throw new Error("Storage failure was not exercised");
    return item;
  }, profileId);
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export backup", exact: true })
    .click();
  const download = await downloadPromise,
    file = info.outputPath("volatile-backup.json");
  await download.saveAs(file);
  const backup = JSON.parse(await readFile(file, "utf8")) as {
    browser: Record<string, string>;
  };
  expect(
    JSON.parse(backup.browser[`nexus-result-v1:${item.sessionId}`]),
  ).toMatchObject(item);
  expect(
    await page.evaluate(
      (id) => localStorage.getItem(`nexus-result-v1:${id}`),
      item.sessionId,
    ),
  ).toBeNull();
});

test("system-menu keyboard focus skips disabled and closed-details controls", async ({
  page,
}) => {
  await page.goto("/home");
  const toggle = page.getByRole("button", { name: "Open system menu" });
  await toggle.click();
  const dialog = page.getByRole("dialog", { name: "System menu" });
  await dialog.evaluate((element) => {
    const disabled = document.createElement("input");
    disabled.disabled = true;
    element.insertBefore(disabled, element.children[1]);
    const details = document.createElement("details"),
      summary = document.createElement("summary"),
      hidden = document.createElement("button");
    summary.textContent = "Additional controls";
    hidden.textContent = "Unavailable while closed";
    details.append(summary, hidden);
    element.append(details);
  });
  const close = dialog.getByRole("button", { name: "Close system menu" });
  await close.focus();
  await page.keyboard.press("Tab");
  await expect(
    dialog.getByRole("button", { name: "Home", exact: true }),
  ).toBeFocused();
  await dialog.getByRole("button", { name: "Settings", exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(dialog.locator("summary")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(toggle).toBeFocused();
});
