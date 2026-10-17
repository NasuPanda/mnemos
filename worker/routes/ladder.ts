import type { Context } from "hono";
import { Hono } from "hono";
import { addStop, gapIssue, removeStop, setGap, type Ladder } from "../../src/core";
import type { LadderErrorResponse, LadderResponse } from "../contract";
import { getDb } from "../db/client";
import { removeStopAndMoveItems, saveLadder } from "../db/ladder";
import { loadLadder } from "../db/today";
import type { AppEnv } from "../env";
import { jsonObject, parseId } from "./params";

/**
 * The ladder editor: change a gap, add a stop, remove a stop. The rules come from src/core; this
 * checks input, compares with the ladder the person saw, and stores the result.
 */
export const ladderRoutes = new Hono<AppEnv>()
  /** PATCH /api/ladder/stops/:stop { ladder, gap } */
  .patch("/stops/:stop", async (c) => {
    const stop = parseId(c.req.param("stop"));
    const body = await jsonObject(c.req);
    const seen = parseLadder(body?.ladder);
    if (!stop || !seen || typeof body?.gap !== "number") {
      return c.json({ error: "a stop, the ladder you saw and a gap are required" }, 400);
    }
    const db = getDb(c.env.DB);
    const userId = c.var.user.id;
    const current = await loadLadder(db, userId);
    if (!sameLadder(current, seen)) return changed(c, current);
    if (stop > current.length) return c.json({ error: "not_found" }, 404);

    const issue = gapIssue(current, stop, body.gap);
    if (issue) return refused(c, { error: issue.kind, ladder: [...current], issue });
    const next = setGap(current, stop, body.gap);
    if (!(await saveLadder(db, userId, current, next)))
      return changed(c, await loadLadder(db, userId));
    return c.json<LadderResponse>({ ladder: [...next] });
  })
  /** POST /api/ladder/stops { ladder } */
  .post("/stops", async (c) => {
    const seen = parseLadder((await jsonObject(c.req))?.ladder);
    if (!seen) return c.json({ error: "the ladder you saw is required" }, 400);
    const db = getDb(c.env.DB);
    const userId = c.var.user.id;
    const current = await loadLadder(db, userId);
    if (!sameLadder(current, seen)) return changed(c, current);

    const result = addStop(current);
    if (!result.ok) return refused(c, { error: result.error, ladder: [...current] });
    if (!(await saveLadder(db, userId, current, result.value))) {
      return changed(c, await loadLadder(db, userId));
    }
    return c.json<LadderResponse>({ ladder: [...result.value] }, 201);
  })
  /** DELETE /api/ladder/stops/:stop?ladder=1,2,3,5,7,14,28 */
  .delete("/stops/:stop", async (c) => {
    const stop = parseId(c.req.param("stop"));
    const seen = parseLadder(c.req.query("ladder")?.split(",").map(Number));
    if (!stop || !seen) return c.json({ error: "a stop and the ladder you saw are required" }, 400);
    const db = getDb(c.env.DB);
    const userId = c.var.user.id;
    const current = await loadLadder(db, userId);
    if (!sameLadder(current, seen)) return changed(c, current);
    if (stop > current.length) return c.json({ error: "not_found" }, 404);

    const result = removeStop(current, stop);
    if (!result.ok) return refused(c, { error: result.error, ladder: [...current] });
    if (!(await removeStopAndMoveItems(db, userId, current, result.value, stop))) {
      return changed(c, await loadLadder(db, userId));
    }
    return c.json<LadderResponse>({ ladder: [...result.value] });
  });

/** A list of whole numbers, as the ladder the person saw; anything else is null. */
function parseLadder(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 50) return null;
  return value.every((gap) => Number.isSafeInteger(gap)) ? (value as number[]) : null;
}

function sameLadder(a: Ladder, b: Ladder): boolean {
  return a.length === b.length && a.every((gap, index) => gap === b[index]);
}

function changed(c: Context<AppEnv>, ladder: Ladder) {
  return c.json<LadderErrorResponse>({ error: "ladder-changed", ladder: [...ladder] }, 409);
}

function refused(c: Context<AppEnv>, body: LadderErrorResponse) {
  return c.json<LadderErrorResponse>(body, 422);
}
