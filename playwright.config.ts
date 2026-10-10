import { defineConfig, devices } from "@playwright/test";

const port = 4173;

export default defineConfig({
  testDir: "e2e",
  // One test at a time: they share the e2e database and reseed it.
  workers: 1,
  forbidOnly: !!process.env.CI,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "phone",
      use: { ...devices["iPhone 13"], viewport: { width: 390, height: 844 } },
    },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
  ],
  // The built app in the Workers runtime, with its own local D1 and R2 (.wrangler/e2e-state)
  // and the dev identity from .dev.vars. Tests reseed that state; your dev data is untouched.
  webServer: {
    command: `npm run db:migrate:e2e && npm run db:seed:e2e && npm run build && MNEMOS_STATE_DIR=.wrangler/e2e-state vite preview --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
