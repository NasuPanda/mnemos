import { defineConfig } from "drizzle-kit";

// drizzle-kit only writes the SQL; wrangler applies it (npm run db:migrate:local / :remote).
export default defineConfig({
  dialect: "sqlite",
  schema: "./worker/db/schema.ts",
  out: "./migrations",
});
