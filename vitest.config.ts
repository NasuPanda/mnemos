import path from "node:path";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        // Scheduling rules: pure TypeScript, no runtime needed.
        test: {
          name: "core",
          include: ["src/core/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        // The app's logic and markup: plain functions and server-rendered components in Node.
        plugins: [react()],
        resolve: { alias: { "@": path.join(import.meta.dirname, "src") } },
        test: {
          name: "ui",
          include: ["src/**/*.test.{ts,tsx}"],
          exclude: ["src/core/**", "**/node_modules/**"],
          environment: "node",
          // CSS imports are empty in tests; the contrast test reads the tokens' own text.
          css: { include: [/src\/styles\/tokens\.css/] },
        },
      },
      {
        // API: runs inside workerd with local D1 and R2 from wrangler.jsonc.
        plugins: [
          cloudflareTest(async () => ({
            wrangler: { configPath: "./wrangler.jsonc" },
            miniflare: {
              bindings: {
                TEST_MIGRATIONS: await readD1Migrations(
                  path.join(import.meta.dirname, "migrations"),
                ),
              },
            },
          })),
        ],
        test: {
          name: "worker",
          include: ["worker/**/*.test.ts"],
          setupFiles: ["./worker/test/apply-migrations.ts"],
        },
      },
    ],
  },
});
