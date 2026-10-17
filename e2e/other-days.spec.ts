import { expect, ITEMS, test } from "./fixtures.ts";

const desktopOnly = (name: string) => test.skip(name !== "desktop", "keyboard run at 1440 × 900");
const phoneOnly = (name: string) => test.skip(name !== "phone", "touch run at 390 × 844");

// The e2e profile has one item due tomorrow: "Dijkstra with a binary heap", on stop 5.

test("reviews tomorrow's item early with only the keyboard", async ({ page }, testInfo) => {
  desktopOnly(testInfo.project.name);
  await page.goto("/");
  await expect(page.getByText("4 left today")).toBeVisible();

  // ] moves to tomorrow: one item due, all of it to review early.
  await page.keyboard.press("]");
  await expect(page).toHaveURL(/\/\?day=\d{4}-\d{2}-\d{2}$/);
  await expect(page.getByRole("link", { name: /Review early · 1/ })).toBeVisible();

  await page.keyboard.press("f");
  await expect(page.getByText(/Reviewing early counts as done today/)).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.getByText("1 of 1", { exact: true })).toBeVisible();
  await page.keyboard.press("Space");
  await expect(page.getByRole("heading", { name: ITEMS.binaryHeap })).toBeVisible();
  // Not at all: back to stop 1, due tomorrow again, so it stays on tomorrow, dimmed.
  await page.keyboard.press("3");

  await expect(page).toHaveURL(/\/\?day=/);
  await expect(page.getByText("1 due · 1 reviewed today").first()).toBeVisible();
  await expect(page.getByText("Reviewed today", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /Review early/ })).toHaveCount(0);

  // Today's Left is untouched, and the early review counts as done.
  await page.keyboard.press("t");
  await expect(page.getByText("4 left today")).toBeVisible();
  await expect(page.getByText(/1 done/)).toBeVisible();

  // Its history marks the review as a day early.
  await page.goto("/items?q=binary");
  await expect(page.getByText(ITEMS.binaryHeap)).toBeVisible();
  await page.keyboard.press("j");
  await page.keyboard.press("h");
  const history = page.getByRole("dialog");
  await expect(history).toContainText("1 day early");
  await expect(history).toContainText("Not at all");
  await page.keyboard.press("Escape");
  await expect(history).toBeHidden();
});

test("reviews tomorrow's item early with taps", async ({ page }, testInfo) => {
  phoneOnly(testInfo.project.name);
  await page.goto("/");
  await expect(page.getByText(/4 left/).first()).toBeVisible();

  // Tomorrow in the week strip; on a Sunday it is next week's, so go there directly.
  const tomorrow = page.getByRole("navigation", { name: "Week" }).getByRole("link", {
    name: /: 1 due$/,
  });
  if ((await tomorrow.count()) > 0) await tomorrow.tap();
  else await page.goto(`/?day=${await page.evaluate(tomorrowInBrowser)}`);
  await expect(page.getByText("Tomorrow", { exact: false }).first()).toBeVisible();

  await page.getByRole("link", { name: /Review early · 1/ }).tap();
  await page.getByRole("button", { name: /^Start/ }).tap();
  await page.getByRole("button", { name: /Show answer/ }).tap();
  // Confident: up to stop 6, two weeks away, so it leaves tomorrow.
  await page.getByRole("button", { name: /^Confident/ }).tap();

  await expect(page.getByText("Nothing due")).toBeVisible();
  await page.getByRole("link", { name: "Today", exact: true }).first().tap();
  await expect(page.getByText(/1 done/)).toBeVisible();
});

function tomorrowInBrowser(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
