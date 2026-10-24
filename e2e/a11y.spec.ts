import { AxeBuilder } from "@axe-core/playwright";
import type { Page, TestInfo } from "@playwright/test";
import { expect, ITEMS, test } from "./fixtures.ts";

/** WCAG 2.2 A and AA, which page 22 holds every text and control pair to. */
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"];

/** The local date `days` from today, as the app sends it. */
function dayFrom(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Waits until nothing on the page moves. A fixed wait wasn't enough on a slow CI machine: axe read
 * the zoom's text while it was still fading in, and the section picker while it was sliding up.
 */
async function stillScreen(page: Page) {
  await page.waitForFunction(() =>
    document.getAnimations().every((motion) => motion.playState !== "running" && !motion.pending),
  );
}

/** Runs axe on what is on screen now; a failure lists each rule and the elements it found. */
async function expectAccessible(page: Page, testInfo: TestInfo, screen: string) {
  await stillScreen(page);
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const found = violations.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.help}\n  ${v.nodes.map((n) => n.target.join(" ")).join("\n  ")}`,
  );
  expect(found, `${screen} at ${testInfo.project.name}`).toEqual([]);
}

const isPhone = (testInfo: TestInfo) => testInfo.project.name === "phone";

test("the dashboard on today, a future day and a past day", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Graphs" })).toBeVisible();
  await expectAccessible(page, testInfo, "today");

  await page.goto(`/?day=${dayFrom(1)}`);
  await expect(page.getByText(ITEMS.binaryHeap)).toBeVisible();
  await expectAccessible(page, testInfo, "a future day");

  await page.goto(`/?day=${dayFrom(-8)}`);
  await expect(page.getByText(ITEMS.dijkstra)).toBeVisible();
  await expectAccessible(page, testInfo, "a past day");
});

test("flash start, both sides of review, zoom and All done", async ({ page }, testInfo) => {
  await page.goto("/flash");
  await expect(page.getByRole("heading", { name: /Kérjük, vigyázzanak/ })).toBeVisible();
  await expectAccessible(page, testInfo, "flash start");

  await page.goto("/review");
  await expect(page.getByText(/Run Dijkstra from S/)).toBeVisible();
  await expectAccessible(page, testInfo, "review, problem side");

  await page.getByRole("button", { name: "Zoom problem image 1" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expectAccessible(page, testInfo, "image zoom");
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();

  await page.getByRole("button", { name: /Show answer/ }).click();
  await expect(page.getByRole("heading", { name: ITEMS.dijkstra })).toBeVisible();
  await expectAccessible(page, testInfo, "review, answer side");

  await page.getByRole("button", { name: /^Pick a date/ }).click();
  await expect(page.getByRole("grid")).toBeVisible();
  await expectAccessible(page, testInfo, "Pick a date");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("grid")).toBeHidden();

  for (let rated = 0; rated < 4; rated++) {
    if (rated > 0) await page.getByRole("button", { name: /Show answer/ }).click();
    await page.getByRole("button", { name: /^Confident/ }).click();
  }
  await expect(page.getByRole("heading", { name: "Végállomás" })).toBeVisible();
  // The Undo pop-up has gone after 4 s; All done on its own.
  await expect(page.getByRole("button", { name: /^Undo/ })).toHaveCount(0, { timeout: 8000 });
  await expectAccessible(page, testInfo, "All done");
});

test("Items, the editor and the section picker", async ({ page }, testInfo) => {
  await page.goto("/items");
  await expect(page.getByText(ITEMS.mutex)).toBeVisible();
  await expectAccessible(page, testInfo, "Items");

  await page.getByText(ITEMS.dijkstra).first().click();
  await expect(page.getByRole("textbox", { name: /^Name/ })).toHaveValue(ITEMS.dijkstra);
  await expectAccessible(page, testInfo, "the editor");

  await page.getByRole("button", { name: /^Section:/ }).click();
  await expect(page.getByRole("combobox", { name: "Find or add a section" })).toBeVisible();
  await expectAccessible(page, testInfo, "the section picker");
});

test("Settings and an item's history", async ({ page }, testInfo) => {
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Menetrend" })).toBeVisible();
  await expectAccessible(page, testInfo, "Settings");

  await page.getByRole("button", { name: "Remove stop 3…" }).click();
  await expect(page.getByRole(isPhone(testInfo) ? "dialog" : "alertdialog")).toContainText(
    "1 item moves down to stop 2",
  );
  await expectAccessible(page, testInfo, "the remove-stop question");

  await page.goto(`/?day=${dayFrom(-8)}`);
  await page.getByText(ITEMS.dijkstra).click();
  await expect(page.getByRole("dialog")).toContainText("History");
  await expectAccessible(page, testInfo, "the history panel");
});

test("the command menu and the shortcut list", async ({ page }, testInfo) => {
  test.skip(isPhone(testInfo), "keys only: nothing opens them on a touch screen");
  await page.goto("/");
  await expect(page.getByText("4 left today")).toBeVisible();

  await page.keyboard.press("ControlOrMeta+k");
  await expect(page.getByRole("dialog", { name: "Command menu" })).toBeVisible();
  await page.keyboard.type("dijk");
  await expectAccessible(page, testInfo, "the command menu");
  await page.keyboard.press("Escape");

  await page.keyboard.press("?");
  await expect(page.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeVisible();
  await expectAccessible(page, testInfo, "the shortcut list");
});
