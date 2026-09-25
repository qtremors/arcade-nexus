import { captureScreenshot } from "./fixtures";
import { test, expect, start, pause, save } from "./fixtures";
import AxeBuilder from "@axe-core/playwright";

test("primary menu focus and 2048 undo work through normal keyboard controls", async ({
  page,
}) => {
  await page.goto("/play/breakout");
  await expect(
    page.getByRole("button", { name: "Start game", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", { name: "Pause (Esc / P)" }),
  ).toBeVisible();
  await pause(page);
  await expect(
    page.getByRole("button", { name: "Resume", exact: true }),
  ).toBeFocused();
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
  await captureScreenshot(page, { path: info.outputPath("oled-home.png") });
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
  await captureScreenshot(page, { path: info.outputPath("oled-launch.png") });
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
  await captureScreenshot(page, {
    path: info.outputPath("settings-zoom-equivalent.png"),
  });
  await info.attach("accessibility-findings.json", {
    body: JSON.stringify(failures, null, 2),
    contentType: "application/json",
  });
  expect(failures).toEqual([]);
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
