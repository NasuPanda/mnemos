import { Hono } from "hono";
import type { MeResponse } from "../contract";
import { getDb } from "../db/client";
import { tutorialCompletedAt } from "../db/tutorial";
import type { AppEnv } from "../env";

/** GET /api/me: who is signed in, as stored in D1, and whether they've done the tutorial. */
export const me = new Hono<AppEnv>().get("/", async (c) => {
  const { id, email } = c.var.user;
  const body: MeResponse = {
    email,
    tutorialCompletedAt: await tutorialCompletedAt(getDb(c.env.DB), id),
  };
  return c.json(body);
});
