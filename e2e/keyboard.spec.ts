import type { Page } from "@playwright/test";
import { expect, ITEMS, test } from "./fixtures.ts";

const desktopOnly = (name: string) => test.skip(name !== "desktop", "keyboard run at 1440 × 900");

test("a whole day with only the keyboard", async ({ page }, testInfo) => {
  desktopOnly(testInfo.project.name);
  await page.goto("/");
  await expect(page.getByText("4 left today")).toBeVisible();

  // J selects the first row, Enter studies it alone, and the run comes back to the dashboard.
  await page.keyboard.press("j");
  await page.keyboard.press("Enter");
  await expect(page.getByText(/Run Dijkstra from S/)).toBeVisible();
  await page.keyboard.press("Space");
  await page.keyboard.press("2");
  await expect(page.getByText("3 left today")).toBeVisible();

  // ? shows every key, and closes again.
  await page.keyboard.press("?");
  await expect(page.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeVisible();
  await page.keyboard.press("Escape");

  // F, Enter at the doors, then Space and a number until All done.
  await page.keyboard.press("f");
  await expect(page.getByRole("heading", { name: /Kérjük, vigyázzanak/ })).toBeVisible();
  await page.keyboard.press("Enter");
  for (let number = 1; number <= 3; number++) {
    await expect(page.getByText(`${number} of 3`, { exact: true })).toBeVisible();
    await page.keyboard.press("Space");
    await page.keyboard.press(String(number));
  }
  await expect(page.getByRole("heading", { name: "Végállomás" })).toBeVisible();

  // The command menu goes to Items; / searches there, Enter picks and opens, Esc goes back.
  await page.keyboard.press("ControlOrMeta+k");
  await page.keyboard.type("items");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL("/items");
  await page.keyboard.press("/");
  await page.keyboard.type("mutex");
  await expect(page.getByRole("link", { name: ITEMS.mutex })).toBeVisible();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("textbox", { name: /^Name/ })).toHaveValue(ITEMS.mutex);
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/items\?q=mutex$/);

  // , opens Settings; Tab reaches the ladder, ← → move along it, Enter edits a gap.
  await page.keyboard.press(",");
  await expect(page.getByRole("heading", { name: "Menetrend" })).toBeVisible();
  // The ladder is one Tab stop, on the selected stop: the Végállomás to begin with.
  await tabTo(page, /^Végállomás, stop 7:/);
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("button", { name: /^Stop 6:/ })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("input:focus")).toHaveValue("14");
  await page.keyboard.press("Escape");

  // T goes back to today, still All done.
  await page.keyboard.press("t");
  await expect(page.getByRole("heading", { name: "Végállomás" })).toBeVisible();
});

/** Presses Tab until the focus reaches the control named `name`. */
async function tabTo(page: Page, name: RegExp) {
  for (let presses = 0; presses < 60; presses++) {
    await page.keyboard.press("Tab");
    const label = await page.evaluate(() => {
      const active = document.activeElement as HTMLElement | null;
      return active?.getAttribute("aria-label") ?? active?.textContent ?? "";
    });
    if (name.test(label)) return;
  }
  throw new Error(`Tab never reached ${name}`);
}

/**
 * Tabs through the screen and lists every stop where the focus can't be seen: the yellow 2 px
 * ring (on the control, or around the field it sits in) must show at each one.
 */
async function unseenFocus(page: Page, presses = 40): Promise<string[]> {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  const unseen: string[] = [];
  for (let press = 0; press < presses; press++) {
    await page.keyboard.press("Tab");
    // The focus ring never animates in, but let the screen settle on its scroll.
    const stop = await page.evaluate(() => {
      const active = document.activeElement as HTMLElement | null;
      if (!active || active === document.body) return null;
      const yellow = (color: string) => color.replace(/\s/g, "") === "rgb(245,196,0)";
      const ringed = (element: Element | null) => {
        if (!element) return false;
        const style = getComputedStyle(element);
        return (
          style.outlineStyle !== "none" &&
          parseFloat(style.outlineWidth) >= 2 &&
          yellow(style.outlineColor)
        );
      };
      const shown =
        ringed(active) ||
        ringed(active.parentElement) ||
        ringed(active.parentElement?.parentElement ?? null);
      const name =
        active.getAttribute("aria-label") ?? active.textContent?.trim().slice(0, 40) ?? "";
      return { shown, what: `${active.tagName.toLowerCase()} "${name}"` };
    });
    if (stop && !stop.shown) unseen.push(stop.what);
  }
  return [...new Set(unseen)];
}

test("every Tab stop shows the yellow focus ring", async ({ page }, testInfo) => {
  desktopOnly(testInfo.project.name);
  const screens: [string, string][] = [
    ["/", "Review"],
    [`/review`, "Review mode"],
    ["/items", "Items"],
    ["/items/new", "New item"],
    ["/settings", "Settings"],
    ["/flash", "Flash start"],
  ];
  const found: string[] = [];
  for (const [path, screen] of screens) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    for (const what of await unseenFocus(page)) found.push(`${screen}: ${what}`);
  }
  expect(found).toEqual([]);
});
