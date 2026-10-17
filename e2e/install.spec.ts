import { expect, test } from "./fixtures.ts";

test("the page names its icons and a manifest sent with the Access cookie", async ({ page }) => {
  await page.goto("/");
  const manifest = page.locator('link[rel="manifest"]');
  await expect(manifest).toHaveAttribute("crossorigin", "use-credentials");
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
    "href",
    "/apple-touch-icon.png",
  );

  const response = await page.request.get((await manifest.getAttribute("href"))!);
  expect(response.ok()).toBe(true);
  const body = (await response.json()) as {
    name: string;
    display: string;
    start_url: string;
    icons: { src: string; purpose: string }[];
  };
  expect(body).toMatchObject({ name: "Mnemos", display: "standalone", start_url: "/" });
  expect(body.icons.map((icon) => icon.purpose)).toContain("maskable");

  for (const src of [
    ...body.icons.map((icon) => icon.src),
    "/favicon.svg",
    "/favicon-32.png",
    "/apple-touch-icon.png",
  ]) {
    const icon = await page.request.get(src);
    expect(icon.ok(), src).toBe(true);
    expect(icon.headers()["content-type"], src).toMatch(/^image\//);
  }
});
