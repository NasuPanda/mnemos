import { expect, test } from "./fixtures.ts";

const desktopOnly = (name: string) => test.skip(name !== "desktop", "keys at 1440 × 900");

test("? lists every shortcut, and the screen's keys wait while it is open", async ({
  page,
}, testInfo) => {
  desktopOnly(testInfo.project.name);
  await page.goto("/");
  await expect(page.getByText("4 left today")).toBeVisible();
  await expect(page.getByText("all keys")).toBeVisible();

  await page.keyboard.press("?");
  const list = page.getByRole("dialog", { name: "Keyboard shortcuts" });
  await expect(list).toBeVisible();
  await expect(list.getByRole("heading", { name: "Everywhere" })).toBeVisible();
  await expect(list.getByText("Undo the last rating")).toBeVisible();

  // J would select the first row; with the list open it does nothing.
  await page.keyboard.press("j");
  await expect(page.locator("[aria-current=true]")).toHaveCount(0);

  await page.keyboard.press("?");
  await expect(list).toBeHidden();
  await page.keyboard.press("j");
  await expect(page.locator("[aria-current=true]")).toHaveCount(1);

  await page.keyboard.press("?");
  await expect(list).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(list).toBeHidden();
  await expect(page).toHaveURL("/");
});

test("? does nothing while typing in a field", async ({ page }, testInfo) => {
  desktopOnly(testInfo.project.name);
  await page.goto("/items");
  const search = page.getByRole("searchbox");
  await search.click();
  await page.keyboard.type("why?");
  await expect(search).toHaveValue("why?");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
