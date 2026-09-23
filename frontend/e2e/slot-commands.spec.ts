import { test, expect, start, pause, save } from "./fixtures";

test("slot deletion can be cancelled and only deletes the current player's save", async ({
  page,
  request,
  profileId,
}) => {
  await start(page, "tetris");
  await pause(page);
  await save(page, "tetris");
  const other = await request.post("/api/profiles", {
    data: { username: `Other saved player ${Date.now()}` },
  });
  expect(other.ok()).toBeTruthy();
  const otherId = (await other.json()).id;
  const otherHeaders = { "X-Profile-ID": String(otherId) };
  expect(
    (
      await request.post("/api/saves/tetris", {
        headers: otherHeaders,
        data: { slot: 1, data: { marker: "Other player's slot" } },
      })
    ).ok(),
  ).toBeTruthy();
  await page.getByRole("button", { name: "Load game", exact: true }).click();
  await page
    .getByRole("button", { name: "Delete slot 1", exact: true })
    .click();
  const confirmation = page.getByRole("alertdialog", {
    name: "Delete slot 1?",
    exact: true,
  });
  await confirmation
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Delete slot 1", exact: true }),
  ).toBeEnabled();
  expect(
    (
      await request.get("/api/saves/tetris", {
        headers: { "X-Profile-ID": String(profileId) },
      })
    ).ok(),
  ).toBeTruthy();
  await page
    .getByRole("button", { name: "Delete slot 1", exact: true })
    .click();
  await confirmation
    .getByRole("button", { name: "Delete save", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Slot 1 · Empty", exact: true }),
  ).toBeDisabled();
  const retained = await request.get("/api/saves/tetris", {
    headers: otherHeaders,
  });
  expect((await retained.json()).saves[0].data.marker).toBe(
    "Other player's slot",
  );
});
