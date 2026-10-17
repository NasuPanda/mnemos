import type { Page } from "@playwright/test";
import { expect, ITEMS, test } from "./fixtures.ts";

const desktopOnly = (name: string) => test.skip(name !== "desktop", "keyboard run at 1440 × 900");
const phoneOnly = (name: string) => test.skip(name !== "phone", "touch run at 390 × 844");

// The e2e profile's items sit on stops 2, 3, 4, 5 and 7 of the default ladder; Page replacement
// is the only one on stop 3.

/** Where the dashboard says each of today's items now is. */
async function expectStops(page: Page, stops: Record<string, string>) {
  for (const [name, stop] of Object.entries(stops)) {
    const row = page.getByRole("link", { name: new RegExp(name) });
    await expect(row.getByRole("img", { name: stop })).toBeVisible();
  }
}

test("removes a stop with the keyboard; a plain Enter doesn't", async ({ page }, testInfo) => {
  desktopOnly(testInfo.project.name);
  await page.goto("/settings");
  await expect(page.getByText("7 of 7 stops · 5 items")).toBeVisible();

  // ← → move between the stops; Del asks to remove the one with the focus.
  await page.getByRole("button", { name: /^Stop 1:/ }).focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Delete");
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("Remove stop 3?");
  await expect(dialog).toContainText("1 item moves down to stop 2 (2 days)");
  await expect(dialog).toContainText("stop 4 becomes stop 3");

  // Cancel has the focus: Enter keeps the stop.
  await page.keyboard.press("Enter");
  await expect(dialog).toBeHidden();
  await expect(page.getByText("7 of 7 stops · 5 items")).toBeVisible();

  await page.keyboard.press("Delete");
  await dialog.getByRole("button", { name: "Remove stop 3" }).click();
  await expect(page.getByText("6 of 7 stops · 5 items")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Stop 2: 2 days, 2 items/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Stop 3: 5 days/ })).toBeVisible();

  // Stop 3's item moved down to stop 2; the stops after it renumbered.
  await page.keyboard.press("t");
  await expectStops(page, {
    [ITEMS.pageReplacement]: "Stop 2 of 6",
    [ITEMS.bellmanFord]: "Stop 2 of 6",
    [ITEMS.dijkstra]: "Stop 3 of 6",
    [ITEMS.mutex]: "Stop 6 of 6",
  });
});

test("removes a stop with taps", async ({ page }, testInfo) => {
  phoneOnly(testInfo.project.name);
  await page.goto("/settings");
  await page.getByRole("button", { name: "Remove stop 3…" }).tap();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toContainText("1 item moves down to stop 2 (2 days)");
  await sheet.getByRole("button", { name: "Remove stop 3" }).tap();
  await expect(page.getByText("6 of 7 stops", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Review", exact: true }).tap();
  await expectStops(page, {
    [ITEMS.pageReplacement]: "Stop 2 of 6",
    [ITEMS.dijkstra]: "Stop 3 of 6",
    [ITEMS.mutex]: "Stop 6 of 6",
  });
});
