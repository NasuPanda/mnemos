import { Hono } from "hono";
import type { KeysFor } from "./auth/access";
import { identity } from "./auth/identity";
import type { AppEnv } from "./env";
import { me } from "./routes/me";

/** The Worker's routes. Only /api/* and /img/* reach it (see run_worker_first in wrangler.jsonc). */
export function createApp(keysFor: KeysFor) {
  const app = new Hono<AppEnv>();

  app.use("*", identity(keysFor));
  app.route("/api/me", me);

  app.notFound((c) => c.json({ error: "not_found" }, 404));
  return app;
}
