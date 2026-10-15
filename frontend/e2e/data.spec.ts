import { captureScreenshot } from "./fixtures";
import { test, expect, start, pause, save } from "./fixtures";
import { readFile } from "node:fs/promises";

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
  await captureScreenshot(page, {
    path: info.outputPath("history-filters.png"),
  });
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
