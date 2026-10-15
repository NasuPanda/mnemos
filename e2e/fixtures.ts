import { execSync } from "node:child_process";
import { test as base, expect } from "@playwright/test";

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
      execSync("npm run db:seed:e2e", { stdio: "ignore" });
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
} as const;
