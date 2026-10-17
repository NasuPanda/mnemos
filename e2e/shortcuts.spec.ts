import { expect, ITEMS, test } from "./fixtures.ts";

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

test("Ctrl/⌘+K finds an item by name and opens it in the editor", async ({ page }, testInfo) => {
  desktopOnly(testInfo.project.name);
  await page.goto("/");
  await expect(page.getByText("4 left today")).toBeVisible();

  await page.keyboard.press("ControlOrMeta+k");
  const menu = page.getByRole("dialog", { name: "Command menu" });
  await expect(menu.getByRole("option", { name: /Flash review · 4/ })).toBeVisible();
  await expect(menu.getByRole("option", { name: /Graphs 2 left/ })).toBeVisible();

  await page.keyboard.type("MUTEX");
  await expect(menu.getByRole("option")).toHaveCount(1);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Edit item" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: /^Name/ })).toHaveValue(ITEMS.mutex);
});

test("leaving the editor with changes asks first, from the menu, a key or a link", async ({
  page,
}, testInfo) => {
  desktopOnly(testInfo.project.name);
  await page.goto("/");
  await expect(page.getByText("4 left today")).toBeVisible();
  await page.keyboard.press("n");
  await page.keyboard.type("Half-written item");

  // The menu: Keep editing stays, with the changes.
  await page.keyboard.press("ControlOrMeta+k");
  await page.keyboard.type("settings");
  await page.keyboard.press("Enter");
  const question = page.getByRole("alertdialog");
  await expect(question).toContainText("Discard your changes?");
  await page.keyboard.press("Enter");
  await expect(question).toBeHidden();
  await expect(page.getByRole("textbox", { name: /^Name/ })).toHaveValue("Half-written item");

  // I (outside a field) asks too.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("i");
  await expect(question).toContainText("Discard your changes?");
  await page.keyboard.press("Escape");
  await expect(question).toBeHidden();
  await expect(page).toHaveURL("/items/new");

  // A link in the sidebar asks too; Discard goes where it pointed.
  await page.getByRole("link", { name: /^Settings/ }).click();
  await expect(question).toContainText("Discard your changes?");
  await page.getByRole("button", { name: "Discard" }).click();
  await expect(page).toHaveURL("/settings");

  // Back goes to the editor, then the dashboard: no step is left over from the question.
  await page.goBack();
  await expect(page.getByRole("heading", { name: "New item" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: /^Name/ })).toHaveValue("");
  await page.goBack();
  await expect(page.getByText("4 left today")).toBeVisible();
});
