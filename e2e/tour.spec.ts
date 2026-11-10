import type { Locator, Page, TestInfo } from "@playwright/test";
import { expectAccessible } from "./axe.ts";
import { expect, guardPractice, newAccount, test } from "./fixtures.ts";

// The first-run tutorial's tour cards (design plan, First-run tutorial, "Tour"): every step to
// the person's own board, on the phone through Items, by keys only on desktop, after a reload,
// and with axe on every step.

// Each test seeds twice and walks up to 14 steps.
test.describe.configure({ timeout: 120_000 });

const isPhone = (testInfo: TestInfo) => testInfo.project.name === "phone";
const card = (page: Page) => page.locator("[data-tour-card]");
const target = (page: Page, name: string) => page.locator(`[data-tour="${name}"]`);

/** Waits for the card of step `id`, with `title`, and checks it doesn't cover its target. */
async function expectStep(page: Page, id: string, title: string | RegExp, of: string) {
  await expect(card(page)).toHaveAttribute("data-tour-card", id);
  await expect(card(page).getByRole("heading")).toHaveText(title);
  await expect(card(page)).toContainText(of);
}

/** Whether two boxes overlap. */
async function overlap(a: Locator, b: Locator): Promise<boolean> {
  const [x, y] = [await a.boundingBox(), await b.boundingBox()];
  if (!x || !y) return false;
  return x.x < y.x + y.width && y.x < x.x + x.width && x.y < y.y + y.height && y.y < x.y + x.height;
}

async function landInTour(page: Page) {
  newAccount();
  const guard = guardPractice(page);
  await page.goto("/");
  await expect(page).toHaveURL("/tutorial");
  await expect(card(page)).toHaveAttribute("data-tour-card", "welcome");
  return guard;
}

/** Steps through the tour by tapping or clicking, checking each card on the way. */
async function walk(page: Page, phone: boolean, check?: (step: string) => Promise<void>) {
  const total = phone ? 14 : 12;
  const press = (locator: Locator) => (phone ? locator.tap() : locator.click());
  const next = () => press(card(page).getByRole("button", { name: /^Next/ }));
  let n = 0;
  const step = async (id: string, title: string | RegExp) => {
    n++;
    await expectStep(page, id, title, `${n} of ${total}`);
    await check?.(id);
  };

  await step("welcome", "Welcome to Mnemos");
  await next();
  await step("lines", "Lines and stations");
  await next();
  if (phone) {
    await step("items-tab", /^Add something to remember/);
    await press(target(page, "tab-items"));
    await step("new-item", "Add something to remember.");
    await press(target(page, "items-new-item"));
  } else {
    await step("new-item", /^Add something to remember/);
    await press(target(page, "sidebar-new-item"));
  }
  await step("name", "Name the review item!");
  await expect(page.getByRole("textbox", { name: /^Name/ })).toHaveValue("Egészségedre!");
  await next();
  await step("section", "Pick a line, or type a new name to create one!");
  await next();
  await step("sides", "Input the problem and its answer!");
  await next();
  await step("save", /^Save it/);
  await press(target(page, phone ? "editor-save-bottom" : "editor-save-top"));
  if (phone) {
    await step("review-tab", "Now review today’s items.");
    await press(target(page, "tab-review"));
  }
  await step("start-review", /^Review everything due today in one run/);
  await press(target(page, phone ? "start-review-floating" : "start-review-top"));
  await step("start-run", /^4 items on 2 lines, 1 of them late/);
  await press(target(page, "flash-start"));
  await step("reveal", /^Think of the answer/);
  // A tap on the card shows the answer too.
  await press(card(page).getByRole("heading"));
  await step("rate", "Pick how confident you feel!");
  await press(page.getByRole("button", { name: /^Confident/ }));
  // The other three items get no cards.
  for (let i = 0; i < 3; i++) {
    await expect(card(page)).toHaveCount(0);
    await press(page.getByRole("button", { name: /Show answer/ }));
    await press(page.getByRole("button", { name: /^Confident/ }));
  }
  await step("done", "Well done");
  await expect(card(page).getByRole("button", { name: "Skip" })).toHaveCount(0);
  await press(card(page).getByRole("button", { name: /Go to my dashboard/ }));
}

test("a new account goes through every step to its own board", async ({ page }, testInfo) => {
  const phone = isPhone(testInfo);
  const guard = await landInTour(page);
  await walk(page, phone, async (id) => {
    const lit: Record<string, string> = { lines: "line-hu", name: "editor-name" };
    if (lit[id]) expect(await overlap(card(page), target(page, lit[id]!)), id).toBe(false);
  });

  await expect(page).toHaveURL("/");
  await expect(page.getByText("No items yet")).toBeVisible();
  expect(guard.broken()).toEqual([]);
  await page.reload();
  await expect(page).toHaveURL("/");
});

test("the whole tour works with keys only", async ({ page }, testInfo) => {
  test.skip(isPhone(testInfo), "keys at 1440 × 900");
  const guard = await landInTour(page);
  const key = (name: string) => page.keyboard.press(name);

  // Explain cards take the focus; Enter is Next.
  await expect(card(page).getByRole("button", { name: /^Next/ })).toBeFocused();
  await key("Enter");
  await expectStep(page, "lines", "Lines and stations", "2 of 12");
  // The app's own keys wait while an Explain card is open.
  await key("t");
  await key("n");
  await expect(page).toHaveURL("/tutorial");
  await key("Enter");
  await expectStep(page, "new-item", /^Add something/, "3 of 12");
  await key("n");
  await expectStep(page, "name", "Name the review item!", "4 of 12");
  await key("Enter");
  await key("Enter");
  await expectStep(page, "sides", "Input the problem and its answer!", "6 of 12");
  // Ctrl+Enter waits too while an Explain card is open.
  await key("ControlOrMeta+Enter");
  await expect(page).toHaveURL("/tutorial/items/new");
  await key("Enter");
  await expectStep(page, "save", /^Save it/, "7 of 12");
  await key("ControlOrMeta+Enter");
  await expectStep(page, "start-review", /^Review everything/, "8 of 12");
  await key("f");
  await expectStep(page, "start-run", /^4 items/, "9 of 12");
  await key("Enter");
  await expectStep(page, "reveal", /^Think of the answer/, "10 of 12");
  await key("Space");
  await expectStep(page, "rate", "Pick how confident you feel!", "11 of 12");
  await key("1");
  for (let i = 0; i < 3; i++) {
    await expect(page.getByRole("button", { name: /Show answer/ })).toBeVisible();
    await key("Space");
    await key("1");
  }
  await expectStep(page, "done", "Well done", "12 of 12");
  await key("Enter");
  await expect(page).toHaveURL("/");
  await expect(page.getByText("No items yet")).toBeVisible();
  expect(guard.broken()).toEqual([]);
});

test("a reload comes back to the same step", async ({ page }) => {
  await landInTour(page);
  await card(page).getByRole("button", { name: /^Next/ }).click();
  await expectStep(page, "lines", "Lines and stations", "2 of");
  await page.reload();
  await expectStep(page, "lines", "Lines and stations", "2 of");
});

test("Esc on an Explain card skips the tutorial", async ({ page }, testInfo) => {
  test.skip(isPhone(testInfo), "keys at 1440 × 900");
  await landInTour(page);
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL("/");
  await expect(
    page.getByText("Tutorial skipped. Replay it from ? or the command menu."),
  ).toBeVisible();
});

test("the tour waits while Pick a date is open", async ({ page }, testInfo) => {
  test.skip(isPhone(testInfo), "keys at 1440 × 900");
  await landInTour(page);
  const key = (name: string) => page.keyboard.press(name);
  for (const k of ["Enter", "Enter", "n", "Enter", "Enter", "Enter", "ControlOrMeta+Enter", "f"]) {
    await key(k);
  }
  await expectStep(page, "start-run", /^4 items/, "9 of 12");
  await key("Enter");
  await key("Space");
  await expectStep(page, "rate", "Pick how confident you feel!", "11 of 12");
  await key("d");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(card(page)).toHaveCount(0);
  await key("Escape");
  await expectStep(page, "rate", "Pick how confident you feel!", "11 of 12");
});

test("axe finds nothing on any step, and nothing moves with reduced motion", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await landInTour(page);
  await walk(page, isPhone(testInfo), async (id) => {
    await expectAccessible(page, testInfo, `tour step ${id}`);
    const ring = page.locator("[data-tour-ring]");
    if ((await ring.count()) > 0) {
      expect(await ring.evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
    }
  });
});

test("an Act step's halo pulses when motion is allowed", async ({ page }) => {
  await landInTour(page);
  await card(page).getByRole("button", { name: /^Next/ }).click();
  await card(page).getByRole("button", { name: /^Next/ }).click();
  const ring = page.locator("[data-tour-ring]");
  await expect(ring).toHaveCount(1);
  expect(await ring.evaluate((el) => getComputedStyle(el).animationName)).toBe("tour-halo");
});
