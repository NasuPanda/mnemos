import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

// The local Worker signs in as DEV_USER_EMAIL from .dev.vars (copy .dev.vars.example).
const devEmail = readFileSync(".dev.vars", "utf8")
  .match(/^DEV_USER_EMAIL=(.+)$/m)?.[1]
  ?.trim()
  .toLowerCase();

test("shows who is signed in, read from D1, on the Dusk background", async ({ page }) => {
  expect(devEmail, "set DEV_USER_EMAIL in .dev.vars").toBeTruthy();

  await page.goto("/");

  await expect(page.getByRole("main")).toContainText(`Signed in as ${devEmail}`);
  const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(background).toBe("rgb(14, 23, 38)"); // --dusk-950
});

test("uses the self-hosted Atkinson Hyperlegible fonts", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("main")).toContainText("Signed in as");

  const fontsReady = await page.evaluate(async () => {
    await document.fonts.ready;
    return document.fonts.check('16px "Atkinson Hyperlegible Next Variable"');
  });
  expect(fontsReady).toBe(true);
});
