import type { Page, TestInfo } from "@playwright/test";
import { expect, guardPractice, newAccount, test } from "./fixtures.ts";

// The first-run tutorial's way in and out, without the tour cards (#29): the gate, the practice
// day under /tutorial, resume, Skip, finishing and Replay (design plan, First-run tutorial).

// Each test seeds twice (the e2e profile, then a new account), so it gets more time.
test.describe.configure({ timeout: 60_000 });

const isPhone = (testInfo: TestInfo) => testInfo.project.name === "phone";
const banner = (page: Page) => page.getByRole("region", { name: "Practice day" });

/** Skip from the tour's card while one is open; the banner's Skip is dimmed under it. */
const skip = (page: Page) =>
  page.locator("[data-tour-card]").getByRole("button", { name: "Skip" }).click();

/** Opens the app as a brand-new account and waits for the practice day. */
async function landInPractice(page: Page) {
  newAccount();
  const guard = guardPractice(page);
  await page.goto("/");
  await expect(page).toHaveURL("/tutorial");
  await expect(banner(page)).toBeVisible();
  await expect(page.getByText("3 left")).toBeVisible();
  return guard;
}

test("a new account lands in the practice day, and a reload keeps its changes", async ({
  page,
}) => {
  const guard = await landInPractice(page);
  await expect(page.getByRole("heading", { name: "Hungarian words" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Algorithms" })).toBeVisible();

  // The editor opens prefilled; saving it adds the fourth item of the run (opened directly, it
  // goes back to Items).
  await page.goto("/tutorial/items/new");
  await expect(page.getByLabel(/^Name/)).toHaveValue("Egészségedre!");
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(page).toHaveURL("/tutorial/items");
  await expect(page.getByText("4 items · 2 lines")).toBeVisible();

  await page.reload();
  await expect(banner(page)).toBeVisible();
  await expect(page).toHaveURL("/tutorial/items");
  await expect(page.getByText("4 items · 2 lines")).toBeVisible();
  expect(guard.broken()).toEqual([]);
});

test("Skip from the editor leaves without asking, for good", async ({ page }, testInfo) => {
  const guard = await landInPractice(page);
  await page.goto("/tutorial/items/new");
  await page.getByLabel(/^Name/).fill("Changed my mind");
  await page.getByRole("button", { name: /^Skip/ }).click();

  await expect(page).toHaveURL("/");
  await expect(page.getByText("No items yet")).toBeVisible();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  const where = isPhone(testInfo) ? "Settings" : "? or the command menu";
  await expect(page.getByText(`Tutorial skipped. Replay it from ${where}.`)).toBeVisible();
  expect(guard.broken()).toEqual([]);

  // Back doesn't reopen the practice day, and nor does a reload.
  await page.goBack();
  await expect(page).not.toHaveURL(/\/tutorial/);
  await expect(banner(page)).toHaveCount(0);
  await page.goto("/");
  await page.reload();
  await expect(page.getByText("No items yet")).toBeVisible();
  await expect(page).toHaveURL("/");
});

test("Replay from Settings starts a fresh practice day and leaves the flag alone", async ({
  page,
}) => {
  await page.goto("/settings");
  const flagWrites: string[] = [];
  page.on("request", (r) => r.url().endsWith("/api/tutorial") && flagWrites.push(r.method()));
  const guard = guardPractice(page);

  await page.getByRole("button", { name: "Replay tutorial" }).click();
  await expect(page).toHaveURL("/tutorial");
  await expect(page.getByText("3 left")).toBeVisible();
  await skip(page);
  await expect(page).toHaveURL("/");
  await expect(page.getByText("4 left today")).toBeVisible();
  expect(flagWrites).toEqual([]);
  expect(guard.broken()).toEqual([]);
});

test("Replay from the command menu and the ? list", async ({ page }, testInfo) => {
  test.skip(isPhone(testInfo), "keys only: the phone replays from Settings");
  await page.goto("/");
  await expect(page.getByText("4 left today")).toBeVisible();

  await page.keyboard.press("ControlOrMeta+k");
  await page.keyboard.type("tour");
  await page.getByRole("option", { name: /Replay tutorial/ }).click();
  await expect(page).toHaveURL("/tutorial");
  await expect(banner(page)).toBeVisible();
  await skip(page);
  await expect(page).toHaveURL("/");

  await expect(page.getByText("4 left today")).toBeVisible();
  await page.keyboard.press("?");
  await page.getByRole("button", { name: "Replay tutorial" }).click();
  await expect(page).toHaveURL("/tutorial");
  await expect(page.getByText("3 left")).toBeVisible();
  // A fresh practice day: the tour starts again at the welcome card.
  await expect(page.locator("[data-tour-card]")).toHaveAttribute("data-tour-card", "welcome");
});
