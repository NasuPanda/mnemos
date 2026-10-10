import { expect, test } from "./fixtures.ts";

// The e2e profile (seed/profiles.ts): four items left today, two of them late; one due tomorrow.

test("shows today's summary and lines on the Dusk background", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText(/4 left/).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Graphs" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Operating systems" })).toBeVisible();

  const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(background).toBe("rgb(14, 23, 38)"); // --dusk-950
});

test("uses the self-hosted Atkinson Hyperlegible fonts", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  const fontsReady = await page.evaluate(async () => {
    await document.fonts.ready;
    return document.fonts.check('16px "Atkinson Hyperlegible Next Variable"');
  });
  expect(fontsReady).toBe(true);
});
