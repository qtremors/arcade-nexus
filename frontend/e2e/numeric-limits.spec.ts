import { test, expect, start, pause, save } from "./fixtures";

test("rejecting an unsupported Tetris save keeps the active run and its session", async ({
  page,
  request,
  profileId,
}) => {
  await start(page, "tetris");
  await pause(page);
  const state = await save(page, "tetris");
  const saved = await request.post("/api/saves/tetris", {
    headers: { "X-Profile-ID": String(profileId) },
    data: {
      slot: 2,
      name: "Unsupported score",
      data: {
        format: 2,
        game: "tetris",
        difficulty: "normal",
        mode: "marathon",
        rules_version: 2,
        state: { ...state, score: 2147483648 },
      },
    },
  });
  expect(saved.ok()).toBeTruthy();
  const completions: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/complete")) completions.push(request.url());
  });
  await page.getByRole("button", { name: "Load game", exact: true }).click();
  await page
    .getByRole("button", { name: "Slot 2 · Unsupported score", exact: true })
    .click();
  await expect(
    page.getByText(
      "This save contains values outside supported limits. Your current run has been kept.",
    ),
  ).toBeVisible();
  expect(completions).toEqual([]);
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Pause (Esc / P)" }),
  ).toBeVisible();
});

test("2048 records the declared maximum tile as a completed run", async ({
  page,
  request,
  profileId,
}) => {
  const stored = await request.post("/api/saves/merge-2048", {
    headers: { "X-Profile-ID": String(profileId) },
    data: {
      slot: 1,
      name: "Maximum tile",
      data: {
        format: 2,
        game: "merge-2048",
        difficulty: "normal",
        mode: "classic",
        rules_version: 4,
        state: {
          version: 1,
          board: [1048576, ...Array(15).fill(0)],
          score: 1048576,
        },
      },
    },
  });
  expect(stored.ok()).toBeTruthy();
  await page.goto("/play/merge-2048");
  await page.getByRole("button", { name: "Load game", exact: true }).click();
  await page
    .getByRole("button", { name: "Slot 1 · Maximum tile", exact: true })
    .click();
  const responsePromise = page.waitForResponse((response) =>
    response.url().endsWith("/progress/merge-2048/complete"),
  );
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Maximum tile reached", exact: true }),
  ).toBeVisible();
  const response = await responsePromise;
  expect(response.ok()).toBeTruthy();
  expect(response.request().postDataJSON()).toMatchObject({
    rules_version: 4,
    score: 1048576,
    metrics: { highest_tile: 1048576, completed: true, ended: true },
  });
});
