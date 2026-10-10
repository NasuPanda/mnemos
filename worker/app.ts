import { Hono } from "hono";
import type { KeysFor } from "./auth/access";
import { identity } from "./auth/identity";
import type { AppEnv } from "./env";
import { me } from "./routes/me";
import { reviewRoutes } from "./routes/reviews";
import { today } from "./routes/today";

/** The Worker's routes. Only /api/* and /img/* reach it (see run_worker_first in wrangler.jsonc). */
export function createApp(keysFor: KeysFor) {
  const app = new Hono<AppEnv>();

  app.use("*", identity(keysFor));
  app.route("/api/me", me);
  app.route("/api/today", today);
  app.route("/api/reviews", reviewRoutes);

  app.notFound((c) => c.json({ error: "not_found" }, 404));
  return app;
}
