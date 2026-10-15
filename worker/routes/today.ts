import { Hono } from "hono";
import { isIsoDate } from "../../src/core";
import type { TodayResponse } from "../contract";
import { getDb } from "../db/client";
import { loadToday } from "../db/today";
import type { AppEnv } from "../env";

/** GET /api/today?date=YYYY-MM-DD: today, as the browser's local date sees it. */
export const today = new Hono<AppEnv>().get("/", async (c) => {
  const date = c.req.query("date");
  if (!isIsoDate(date)) return c.json({ error: "date must be YYYY-MM-DD" }, 400);
  const body: TodayResponse = await loadToday(getDb(c.env.DB), c.var.user.id, date);
  return c.json(body);
});
