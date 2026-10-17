import { Hono } from "hono";
import { CONFIDENCES, isIsoDate, rate, undo, type Confidence } from "../../src/core";
import type { RateRequest, RateResponse, UndoResponse } from "../contract";
import { getDb } from "../db/client";
import { deleteReview, loadForRating, loadReview, saveReview } from "../db/reviews";
import { toReviewDto } from "../db/today";
import type { AppEnv } from "../env";
import { isUniqueViolation, parseId } from "./params";

/** Ratings and Undo. The rules come from src/core; this only checks input and stores results. */
export const reviewRoutes = new Hono<AppEnv>()
  /** POST /api/reviews: rate an item today. */
  .post("/", async (c) => {
    const input = parseRateRequest(await c.req.json().catch(() => null));
    if (!input) return c.json({ error: "itemId, date and confidence are required" }, 400);

    const db = getDb(c.env.DB);
    const userId = c.var.user.id;
    const { item, reviewedToday, ladder } = await loadForRating(
      db,
      userId,
      input.itemId,
      input.date,
    );
    if (!item) return c.json({ error: "not_found" }, 404);

    const result = rate({
      item,
      ladder,
      today: input.date,
      confidence: input.confidence,
      pickedDate: input.pickedDate,
      reviewedToday,
    });
    if (!result.ok) {
      const status = result.error === "already-reviewed-today" ? 409 : 422;
      return c.json({ error: result.error }, status);
    }

    const saved = await saveReview(db, userId, input.itemId, result.value).catch(
      (error: unknown) => {
        // Two ratings racing for the same item: UNIQUE (item_id, reviewed_on) refuses the second.
        if (isUniqueViolation(error)) return null;
        throw error;
      },
    );
    if (!saved) return c.json({ error: "already-reviewed-today" }, 409);

    const body: RateResponse = {
      review: toReviewDto(saved),
      item: { id: input.itemId, stop: saved.stopAfter, dueOn: saved.nextDueOn },
    };
    return c.json(body, 201);
  })
  /** DELETE /api/reviews/:id?date=YYYY-MM-DD: Undo, only for a review made today. */
  .delete("/:id", async (c) => {
    const reviewId = parseId(c.req.param("id"));
    const date = c.req.query("date");
    if (!reviewId || !isIsoDate(date)) {
      return c.json({ error: "a review id and date are required" }, 400);
    }

    const db = getDb(c.env.DB);
    const review = await loadReview(db, c.var.user.id, reviewId);
    if (!review) return c.json({ error: "not_found" }, 404);

    const restored = undo(review, date);
    if (!restored.ok) return c.json({ error: restored.error }, 409);
    if (!(await deleteReview(db, c.var.user.id, review))) {
      return c.json({ error: "item-changed" }, 409);
    }

    const body: UndoResponse = { item: { id: review.itemId, ...restored.value } };
    return c.json(body);
  });

function parseRateRequest(body: unknown): RateRequest | null {
  if (typeof body !== "object" || body === null) return null;
  const { itemId, date, confidence, pickedDate } = body as Record<string, unknown>;
  if (typeof itemId !== "number" || !Number.isSafeInteger(itemId) || itemId < 1) return null;
  if (!isIsoDate(date)) return null;
  if (!CONFIDENCES.includes(confidence as Confidence)) return null;
  if (pickedDate !== undefined && typeof pickedDate !== "string") return null;
  return { itemId, date, confidence: confidence as Confidence, pickedDate };
}
