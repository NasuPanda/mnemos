import { expect, test } from "./fixtures.ts";

const desktopOnly = (name: string) => test.skip(name !== "desktop", "keyboard run at 1440 × 900");
const phoneOnly = (name: string) => test.skip(name !== "phone", "touch run at 390 × 844");

const IMAGES = ["seed/images/fig1-graph.webp", "seed/images/fig2-pseudocode.webp"];

test("creates an item with two images on a phone, then finds it with search", async ({
  page,
}, testInfo) => {
  phoneOnly(testInfo.project.name);
  await page.goto("/items");
  await page.getByRole("link", { name: "New item" }).tap();
  await expect(page.getByRole("heading", { name: "New item" })).toBeVisible();

  await page.getByRole("textbox", { name: /^Name/ }).fill("Kruskal vs Prim: when to use which");

  // A new line, made on the spot: the suggested code and the next colour.
  await page.getByRole("button", { name: /^Section:/ }).tap();
  const sheet = page.getByRole("dialog");
  await sheet.getByRole("combobox").fill("Compilers");
  await expect(sheet.getByText("next colour M4 green")).toBeVisible();
  await sheet.getByRole("option", { name: /Create “Compilers”/ }).tap();
  await expect(page.getByRole("button", { name: "Section: COM Compilers" })).toBeVisible();

  await page
    .getByRole("textbox", { name: /^Problem description/ })
    .fill("Which one wins on a dense graph?");

  // Two photos from the library: shrunk, named and uploaded straight away.
  await expect(page.getByRole("button", { name: "Photo library" }).first()).toBeVisible();
  await page.getByLabel("Choose photos").first().setInputFiles(IMAGES);
  const problemImages = page.getByRole("group", { name: "Problem images" });
  await expect(problemImages.getByRole("img")).toHaveCount(2);
  await expect(problemImages.getByText("Uploading")).toHaveCount(0);

  await page.getByRole("button", { name: "Save" }).tap();
  await expect(page).toHaveURL(/\/items$/);

  await page.getByRole("searchbox", { name: "Search items" }).fill("kruskal");
  await expect(page.getByText(/1 item match “kruskal”/)).toBeVisible();
  await page.getByRole("link", { name: /Kruskal vs Prim/ }).tap();

  // The editor shows the saved images, served by the Worker.
  await expect(page.getByRole("heading", { name: "Edit item" })).toBeVisible();
  const saved = page.getByRole("group", { name: "Problem images" }).getByRole("img");
  await expect(saved).toHaveCount(2);
  await expect(saved.first()).toHaveAttribute("src", /^\/img\/[0-9a-f]{64}\.(webp|jpg)$/);
  expect(await saved.first().evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(
    0,
  );

  // New items are due the day they're added: it's on today's list.
  await page.goto("/");
  await expect(page.getByText(/5 left/).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Compilers" })).toBeVisible();
});

test("adds, edits and deletes an item with only the keyboard", async ({ page }, testInfo) => {
  desktopOnly(testInfo.project.name);
  await page.goto("/");
  await expect(page.getByText("4 left today")).toBeVisible();

  // N: a new item; the name has the focus.
  await page.keyboard.press("n");
  await expect(page.getByRole("heading", { name: "New item" })).toBeVisible();
  await page.keyboard.type("Heap sort is not stable");

  // Save without a section says what's missing, in words.
  await page.keyboard.press("Control+Enter");
  await expect(page.getByText("Pick a section, or type a new name to create one.")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Section:/ })).toBeFocused();
  await page.keyboard.press("Enter");
  await page.keyboard.type("oper");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Section: OS Operating systems" })).toBeVisible();

  // Ctrl+Enter saves and goes back to where the editor was opened.
  await page.keyboard.press("Control+Enter");
  await expect(page.getByText("5 left today")).toBeVisible();

  // "/" searches from the dashboard; Enter picks the first result, Enter again edits it.
  await page.keyboard.press("/");
  await expect(page.getByRole("searchbox", { name: "Search items" })).toBeFocused();
  await page.keyboard.type("heap sort");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Edit item" })).toBeVisible();
  await page.getByRole("textbox", { name: /^Description/ }).fill("Equal keys can swap places.");
  await page.keyboard.press("Control+Enter");
  await expect(page).toHaveURL(/\/items\?q=heap\+sort$/);

  // Esc with unsaved changes asks first; Keep editing has the focus.
  await page.keyboard.press("Enter");
  await expect(page.getByRole("textbox", { name: /^Description/ })).toHaveValue(
    "Equal keys can swap places.",
  );
  await page.getByRole("textbox", { name: /^Description/ }).fill("Changed my mind");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("alertdialog")).toContainText("Discard your changes?");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("alertdialog")).toBeHidden();
  await expect(page.getByRole("textbox", { name: /^Description/ })).toHaveValue("Changed my mind");

  // Delete asks first, and a plain Enter cancels.
  await page.getByRole("button", { name: "Delete item…" }).click();
  await expect(page.getByRole("alertdialog")).toContainText("It has no reviews yet.");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("alertdialog")).toBeHidden();
  await page.getByRole("button", { name: "Delete item…" }).click();
  await page.getByRole("button", { name: "Delete item", exact: true }).click();
  await expect(page).toHaveURL(/\/items\?q=heap\+sort$/);
  await expect(page.getByText("Nothing matches “heap sort”")).toBeVisible();
});

test("E edits the item in review and the run goes on where it was", async ({ page }, testInfo) => {
  desktopOnly(testInfo.project.name);
  await page.goto("/review");
  await expect(page.getByText("1 of 4", { exact: true })).toBeVisible();
  await page.keyboard.press("Space");
  await page.keyboard.press("e");

  await expect(page.getByRole("heading", { name: "Edit item" })).toBeVisible();
  await page.getByRole("textbox", { name: /^Side note/ }).fill("Think of the **queue** order.");
  await page.keyboard.press("Control+Enter");

  await expect(page.getByText("1 of 4", { exact: true })).toBeVisible();
  await expect(page.getByText("Think of the queue order.")).toBeVisible();
  await page.keyboard.press("1");
  await expect(page.getByText("2 of 4", { exact: true })).toBeVisible();
});
