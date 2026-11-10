import { AxeBuilder } from "@axe-core/playwright";
import { expect, type Page, type TestInfo } from "@playwright/test";

/** WCAG 2.2 A and AA, which page 22 holds every text and control pair to. */
export const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"];

/**
 * Waits until nothing on the page moves. A fixed wait wasn't enough on a slow CI machine: axe read
 * the zoom's text while it was still fading in, and the section picker while it was sliding up.
 */
export async function stillScreen(page: Page) {
  await page.waitForFunction(() =>
    document.getAnimations().every((motion) => motion.playState !== "running" && !motion.pending),
  );
}

/** Runs axe on what is on screen now; a failure lists each rule and the elements it found. */
export async function expectAccessible(page: Page, testInfo: TestInfo, screen: string) {
  await stillScreen(page);
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const found = violations.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.help}\n  ${v.nodes.map((n) => n.target.join(" ")).join("\n  ")}`,
  );
  expect(found, `${screen} at ${testInfo.project.name}`).toEqual([]);
}
