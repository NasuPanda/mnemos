import { Hono } from "hono";
import { isIsoDate } from "../../src/core";
import type { DayResponse } from "../contract";
import { getDb } from "../db/client";
import { loadDay } from "../db/days";
import type { AppEnv } from "../env";

/**
 * GET /api/days/:date?today=YYYY-MM-DD: any day for the dashboard. The browser sends its own
 * today, which decides whether `date` is past or future.
 */
export const days = new Hono<AppEnv>().get("/:date", async (c) => {
  const date = c.req.param("date");
  const today = c.req.query("today");
  if (!isIsoDate(date) || !isIsoDate(today)) {
    return c.json({ error: "the date and today must be YYYY-MM-DD" }, 400);
  }
  const body: DayResponse = await loadDay(getDb(c.env.DB), c.var.user.id, date, today);
  return c.json(body);
});
