import { execSync } from "node:child_process";
import { test as base, expect, type Page } from "@playwright/test";

/**
 * Runs a seed command. A failure says what wrangler said, and gets two more tries a second
 * apart, for a short-lived lock on the local D1.
 */
function seed(command: string): void {
  for (let attempt = 1; ; attempt++) {
    try {
      execSync(command, { stdio: "pipe" });
      return;
    } catch (error) {
      if (attempt === 3) {
        const { stdout, stderr } = error as { stdout?: Buffer; stderr?: Buffer };
        throw new Error(`${command} failed:\n${stderr ?? ""}${stdout ?? ""}`, { cause: error });
      }
      execSync("sleep 1");
    }
  }
}

/**
 * Every test starts from the e2e profile (seed/profiles.ts), reseeded into .wrangler/e2e-state:
 * Graphs: "Why Dijkstra fails on negative edges" (stop 4, +3 days, two problem images, a link)
 *         and "Bellman–Ford: detect a negative cycle" (stop 2, +1 day, a link);
 * Operating systems: "Mutex vs semaphore" (name only, last stop) and "Page replacement: clock
 * algorithm" (stop 3); and one Graphs item due tomorrow.
 */
export const test = base.extend<{ seeded: void }>({
  seeded: [
    // eslint-disable-next-line no-empty-pattern -- Playwright needs the destructuring pattern.
    async ({}, use) => {
      seed("npm run db:seed:e2e");
      await use();
    },
    { auto: true },
  ],
});

export { expect };

export const ITEMS = {
  dijkstra: "Why Dijkstra fails on negative edges",
  bellmanFord: "Bellman–Ford: detect a negative cycle",
  mutex: "Mutex vs semaphore",
  pageReplacement: "Page replacement: clock algorithm",
  /** Due tomorrow, on stop 5. */
  binaryHeap: "Dijkstra with a binary heap",
} as const;

/**
 * Makes the e2e account brand new: no data, and the first-run tutorial not done, so the gate
 * sends it to the practice day. Call it before the first page load.
 */
export function newAccount(): void {
  seed("node scripts/seed.ts --new --persist-to=.wrangler/e2e-state");
}

/**
 * Watches what the practice day asks the Worker. While the address is under /tutorial, only
 * GET /api/me and PUT /api/tutorial may reach it, and no /img/ address; `broken()` lists the
 * rest.
 */
export function guardPractice(page: Page): { broken: () => string[] } {
  const broken: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (!/^\/(api|img)\//.test(url.pathname)) return;
    if (!/^\/tutorial(\/|$)/.test(new URL(page.url()).pathname)) return;
    const call = `${request.method()} ${url.pathname}`;
    if (call !== "GET /api/me" && call !== "PUT /api/tutorial") broken.push(call);
  });
  return { broken: () => broken };
}
