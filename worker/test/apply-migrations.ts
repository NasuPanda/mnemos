import { applyD1Migrations, env, type D1Migration } from "cloudflare:test";

// TEST_MIGRATIONS is a test-only binding added in vitest.config.ts.
const { TEST_MIGRATIONS } = env as unknown as { TEST_MIGRATIONS: D1Migration[] };

await applyD1Migrations(env.DB, TEST_MIGRATIONS);
