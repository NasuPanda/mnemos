import type { Page } from "@playwright/test";
import { expect, ITEMS, test } from "./fixtures.ts";

/** The sheet's and its overlay's motion, in seconds, as the page has worked them out. */
function sheetTiming(page: Page) {
  return page.evaluate(() => {
    const style = (slot: string) =>
      getComputedStyle(document.querySelector(`[data-slot="${slot}"]`)!);
    const sheet = style("drawer-content");
    const overlay = style("drawer-overlay");
    return {
      slide: sheet.animationName,
      sheet: parseFloat(sheet.animationDuration),
      // vaul times the slide back after a drag inline; this must win over it.
      dragBack: parseFloat(sheet.transitionDuration),
      overlay: parseFloat(overlay.animationDuration),
    };
  });
}

async function openSectionPicker(page: Page) {
  await page.goto("/items");
  await page.getByText(ITEMS.dijkstra).first().click();
  await expect(page.getByRole("textbox", { name: /^Name/ })).toHaveValue(ITEMS.dijkstra);
  await page.getByRole("button", { name: /^Section:/ }).click();
  await expect(page.getByRole("combobox", { name: "Find or add a section" })).toBeVisible();
}

test("a phone sheet slides up in 150 ms, and at once with reduced motion", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "sheets are the phone's; desktop uses popovers");

  await openSectionPicker(page);
  expect(await sheetTiming(page)).toEqual({
    slide: "slideFromBottom",
    sheet: 0.15,
    dragBack: 0.15,
    overlay: 0.15,
  });

  await page.emulateMedia({ reducedMotion: "reduce" });
  await openSectionPicker(page);
  const reduced = await sheetTiming(page);
  for (const seconds of [reduced.sheet, reduced.dragBack, reduced.overlay]) {
    expect(seconds).toBeLessThan(0.001);
  }
});
