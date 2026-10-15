import type { Page } from "@playwright/test";
import { expect, ITEMS, test } from "./fixtures.ts";

const desktopOnly = (name: string) => test.skip(name !== "desktop", "keyboard run at 1440 × 900");
const phoneOnly = (name: string) => test.skip(name !== "phone", "touch run at 390 × 844");

async function onItem(page: Page, number: number, total = 4) {
  await expect(page.getByText(`${number} of ${total}`, { exact: true })).toBeVisible();
}

test("reviews three items with only the keyboard", async ({ page }, testInfo) => {
  desktopOnly(testInfo.project.name);
  await page.goto("/");
  await expect(page.getByText("4 left today")).toBeVisible();

  await page.keyboard.press("f");
  await expect(page.getByRole("heading", { name: /Kérjük, vigyázzanak/ })).toBeVisible();
  await page.keyboard.press("Enter");

  // Dijkstra (+3 days) first, then Bellman–Ford (+1 day), then the Operating systems line.
  await onItem(page, 1);
  await expect(page.getByText(/Run Dijkstra from S/)).toBeVisible();
  await page.keyboard.press("Space");
  await expect(page.getByRole("heading", { name: ITEMS.dijkstra })).toBeVisible();
  await page.keyboard.press("1");

  await onItem(page, 2);
  await page.keyboard.press("Space");
  await page.keyboard.press("2");

  await onItem(page, 3);
  await expect(page.getByRole("heading", { name: ITEMS.mutex })).toBeVisible();
  await page.keyboard.press("Space");
  await page.keyboard.press("3");

  await onItem(page, 4);
  await page.keyboard.press("Escape");
  await expect(page.getByText("1 left today")).toBeVisible();
  await expect(page.getByText("3 done")).toBeVisible();

  // The ratings were saved: a reload shows the same day.
  await page.reload();
  await expect(page.getByText("1 left today")).toBeVisible();
});

test("reviews with taps until All done, and it survives a reload", async ({ page }, testInfo) => {
  phoneOnly(testInfo.project.name);
  await page.goto("/");
  await page.getByRole("link", { name: /Start review · 4/ }).tap();
  await page.getByRole("button", { name: /^Start/ }).tap();

  for (let number = 1; number <= 4; number++) {
    await onItem(page, number);
    await page.getByRole("button", { name: /Show answer/ }).tap();
    await page.getByRole("button", { name: /^Confident/ }).tap();
  }

  await expect(page.getByRole("heading", { name: "Végállomás" })).toBeVisible();
  await expect(page.getByText("4 reviewed today.")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Végállomás" })).toBeVisible();
  await expect(page.getByText("4 reviewed today.")).toBeVisible();
});

test("a tap anywhere reveals the answer, but images open zoom and links open", async ({
  page,
  context,
}, testInfo) => {
  phoneOnly(testInfo.project.name);
  await page.goto("/review");
  await onItem(page, 1);

  // An image opens zoom without revealing.
  await page.getByRole("button", { name: "Zoom problem image 1" }).tap();
  await expect(page.getByRole("dialog")).toContainText("1 / 2");
  // Playwright has no Safari toolbar, so this only guards the plain layout.
  await expect(page.getByRole("button", { name: "Close zoom" })).toBeInViewport({ ratio: 1 });
  await page.getByRole("button", { name: "Close zoom" }).tap();
  await expect(page.getByRole("button", { name: /Show answer/ })).toBeVisible();

  // A link opens in a new tab without revealing.
  const [tab] = await Promise.all([
    context.waitForEvent("page"),
    page.getByRole("link", { name: /example\.edu\/algo\/lecture-07\.pdf/ }).tap(),
  ]);
  await tab.close();
  await expect(page.getByRole("button", { name: /Show answer/ })).toBeVisible();

  // Anywhere else reveals.
  await page.getByText(/Run Dijkstra from S/).tap();
  await expect(page.getByRole("heading", { name: ITEMS.dijkstra })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Confident/ })).toBeVisible();
});

test("Back closes the zoom and leaves the item as it was", async ({ page }, testInfo) => {
  phoneOnly(testInfo.project.name);
  await page.goto("/");
  await page.getByRole("link", { name: /Start review · 4/ }).tap();
  await page.getByRole("button", { name: /^Start/ }).tap();
  await onItem(page, 1);

  await page.getByRole("button", { name: "Zoom problem image 1" }).tap();
  await page.getByRole("button", { name: "Next image" }).tap();
  await expect(page.getByRole("dialog")).toContainText("2 / 2");
  await page.goBack();
  await expect(page.getByRole("dialog")).toBeHidden();
  await onItem(page, 1);
  await expect(page.getByRole("button", { name: /Show answer/ })).toBeVisible();

  // Closed with its button, the zoom leaves nothing in the history: Back leaves the review.
  await page.getByRole("button", { name: "Zoom problem image 1" }).tap();
  await page.getByRole("button", { name: "Close zoom" }).tap();
  await expect(page.getByRole("dialog")).toBeHidden();
  await page.goBack();
  await expect(page.getByText("4 left today")).toBeVisible();
});

test("Undo puts the item back and returns to it", async ({ page }, testInfo) => {
  desktopOnly(testInfo.project.name);
  await page.goto("/review");
  await onItem(page, 1);
  await page.keyboard.press("Space");
  await page.keyboard.press("3");

  await onItem(page, 2);
  const toast = page.locator("[data-sonner-toast]");
  await expect(toast).toContainText("Not at all");
  await toast.getByRole("button", { name: /Undo/ }).click();

  await onItem(page, 1);
  await expect(page.getByRole("heading", { name: ITEMS.dijkstra })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByText("4 left today")).toBeVisible();

  await page.reload();
  await expect(page.getByText("4 left today")).toBeVisible();
  await expect(page.getByText("0 done")).toBeVisible();
});

test("a picked date replaces the date and keeps the ladder move", async ({ page }, testInfo) => {
  desktopOnly(testInfo.project.name);
  await page.goto("/review");
  await onItem(page, 1);
  await page.keyboard.press("Space");
  await page.keyboard.press("d");

  const calendar = page.locator("[data-slot=popover-content]");
  await expect(calendar).toBeVisible();
  // The first enabled day is tomorrow: today and the past can't be picked.
  await calendar.locator("button[data-day]:not([disabled])").first().click();
  await expect(page.getByText(/Date picked:/)).toBeVisible();

  await page.keyboard.press("1");
  await expect(page.locator("[data-sonner-toast]")).toContainText("stop 5");
});
