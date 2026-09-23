import { test as base, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
export { expect } from "@playwright/test";
// These requests target only serve_backend.py's temporary household database.
export const test = base.extend<{ profileId: number; pageErrors: void }>({
  profileId: async ({ request }, provide, info) => {
    const response = await request.post("/api/profiles", {
      data: {
        username:
          "Browser-" +
          Date.now() +
          "-" +
          info.workerIndex +
          "-" +
          Math.random().toString(16).slice(2, 6),
        avatar: "🎮",
      },
    });
    expect(response.ok()).toBeTruthy();
    try {
      await provide((await response.json()).id);
    } finally {
      const household = await request.get("/api/profiles");
      for (const profile of (await household.json()).profiles) {
        const deleted = await request.delete("/api/profiles/" + profile.id);
        expect(deleted.ok()).toBeTruthy();
      }
    }
  },
  page: async ({ page, profileId }, provide) => {
    await page.addInitScript((id) => {
      sessionStorage.setItem("arcade_nexus_session_booted", "true");
      sessionStorage.setItem("nexus-profile", String(id));
    }, profileId);
    await provide(page);
  },
  pageErrors: [
    async ({ page }, provide) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await provide();
      expect(errors).toEqual([]);
    },
    { auto: true },
  ],
});
export const start = async (page: Page, slug: string) => {
  await page.goto(`/play/${slug}`);
  await page.getByRole("button", { name: "Start game", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Pause (Esc / P)" }),
  ).toBeVisible();
};
export const pause = async (page: Page) => {
  await expect(
    page.getByRole("button", { name: "Pause (Esc / P)" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("heading", { name: "Paused", exact: true }),
  ).toBeVisible();
};
export const save = async (page: Page, slug: string, slot = 1) => {
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

/** Optional review artifacts: software compositor captures can stall independently of gameplay. */
export async function captureScreenshot(
  page: Page,
  options: NonNullable<Parameters<Page["screenshot"]>[0]>,
) {
  if (process.env.ARCADE_CAPTURE_E2E !== "1") return;
  await page.screenshot({ ...options, timeout: 10000 });
}
