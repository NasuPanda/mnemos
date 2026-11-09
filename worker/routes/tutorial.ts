import { Hono } from "hono";
import type { CompleteTutorialRequest } from "../contract";
import { getDb } from "../db/client";
import { completeTutorial } from "../db/tutorial";
import type { AppEnv } from "../env";
import { jsonObject } from "./params";

/** The first-run tutorial's flag. Only the Worker sets it, and only once. */
export const tutorialRoutes = new Hono<AppEnv>()
  /** PUT /api/tutorial: the person finished or skipped it. Repeating it changes nothing. */
  .put("/", async (c) => {
    const body = (await jsonObject(c.req)) as Partial<CompleteTutorialRequest> | null;
    if (body?.completed !== true) return c.json({ error: "completed must be true" }, 400);
    await completeTutorial(getDb(c.env.DB), c.var.user.id);
    return c.body(null, 204);
  });
