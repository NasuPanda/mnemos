import { Hono } from "hono";
import type { AppEnv } from "../env";

/** GET /api/me: who is signed in, as stored in D1. */
export const me = new Hono<AppEnv>().get("/", (c) => c.json({ email: c.var.user.email }));
