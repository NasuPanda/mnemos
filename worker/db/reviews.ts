import { and, eq } from "drizzle-orm";
import {
  DEFAULT_LADDER,
  validateLadder,
  type IsoDate,
  type Ladder,
  type Review,
} from "../../src/core";
import type { ReviewDto } from "../contract";
import type { Db } from "./client";
import { items, reviews, settings, type ReviewRow } from "./schema";

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

/** What rating an item needs: the item, whether it has a review today, and the person's ladder. */
export async function loadForRating(db: Db, userId: number, itemId: number, date: IsoDate) {
  const [itemRows, reviewRows, settingsRows] = await db.batch([
    db
      .select({ stop: items.stop, dueOn: items.dueOn })
      .from(items)
      .where(and(eq(items.id, itemId), eq(items.userId, userId))),
    db
      .select({ id: reviews.id })
      .from(reviews)
      .where(and(eq(reviews.itemId, itemId), eq(reviews.reviewedOn, date))),
    db
      .select({ ladderDays: settings.ladderDays })
      .from(settings)
      .where(eq(settings.userId, userId)),
  ]);
  const ladder: Ladder = settingsRows[0]?.ladderDays ?? DEFAULT_LADDER;
  if (validateLadder(ladder).length > 0) throw new Error("Stored ladder is invalid");
  return { item: itemRows[0] ?? null, reviewedToday: reviewRows.length > 0, ladder };
}

/**
 * Stores a review and moves the item, in one D1 batch. Both happen only if the item still has
 * the stop and due date the rating started from; otherwise nothing changes and this returns
 * null. A second review on the same day fails the UNIQUE (item_id, reviewed_on) check.
 */
export async function saveReview(
  db: Db,
  userId: number,
  itemId: number,
  review: Review,
): Promise<ReviewRow | null> {
  const d1 = db.$client;
  const unchanged = "id = ?2 AND user_id = ?1 AND stop = ?5 AND due_on = ?7";
  const [inserted] = await d1.batch<RawReview>([
    d1
      .prepare(
        `INSERT INTO reviews (user_id, item_id, reviewed_on, confidence, stop_before, stop_after, was_due_on, next_due_on, manual)
         SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9
         WHERE EXISTS (SELECT 1 FROM items WHERE ${unchanged})
         RETURNING *`,
      )
      .bind(
        userId,
        itemId,
        review.reviewedOn,
        review.confidence,
        review.stopBefore,
        review.stopAfter,
        review.wasDueOn,
        review.nextDueOn,
        review.manual ? 1 : 0,
      ),
    d1
      .prepare(
        `UPDATE items SET stop = ?6, due_on = ?8, updated_at = ${NOW}
         WHERE ${unchanged}`,
      )
      .bind(
        userId,
        itemId,
        review.reviewedOn,
        review.confidence,
        review.stopBefore,
        review.stopAfter,
        review.wasDueOn,
        review.nextDueOn,
      ),
  ]);
  const row = inserted?.results[0];
  return row ? fromRaw(row) : null;
}

/** A review of this person's, or null. */
export async function loadReview(
  db: Db,
  userId: number,
  reviewId: number,
): Promise<ReviewRow | null> {
  const [row] = await db
    .select()
    .from(reviews)
    .where(and(eq(reviews.id, reviewId), eq(reviews.userId, userId)));
  return row ?? null;
}

/**
 * Undo, in one D1 batch: delete the review and put the item back on stop_before and was_due_on.
 * Both happen only if the item is still where this review put it; returns whether they did.
 */
export async function deleteReview(db: Db, userId: number, review: ReviewRow): Promise<boolean> {
  const d1 = db.$client;
  const whereReviewLeftIt = "id = ?3 AND user_id = ?2 AND stop = ?4 AND due_on = ?5";
  const [deleted] = await d1.batch<{ id: number }>([
    d1
      .prepare(
        `DELETE FROM reviews WHERE id = ?1 AND user_id = ?2
         AND EXISTS (SELECT 1 FROM items WHERE ${whereReviewLeftIt})
         RETURNING id`,
      )
      .bind(review.id, userId, review.itemId, review.stopAfter, review.nextDueOn),
    d1
      .prepare(
        `UPDATE items SET stop = ?6, due_on = ?7, updated_at = ${NOW}
         WHERE ${whereReviewLeftIt} AND NOT EXISTS (SELECT 1 FROM reviews WHERE id = ?1)`,
      )
      .bind(
        review.id,
        userId,
        review.itemId,
        review.stopAfter,
        review.nextDueOn,
        review.stopBefore,
        review.wasDueOn,
      ),
  ]);
  return (deleted?.results.length ?? 0) > 0;
}

type RawReview = {
  id: number;
  user_id: number;
  item_id: number;
  reviewed_on: string;
  confidence: ReviewRow["confidence"];
  stop_before: number;
  stop_after: number;
  was_due_on: string;
  next_due_on: string;
  manual: number;
  reviewed_at: string;
};

function fromRaw(row: RawReview): ReviewRow {
  return {
    id: row.id,
    userId: row.user_id,
    itemId: row.item_id,
    reviewedOn: row.reviewed_on,
    confidence: row.confidence,
    stopBefore: row.stop_before,
    stopAfter: row.stop_after,
    wasDueOn: row.was_due_on,
    nextDueOn: row.next_due_on,
    manual: row.manual === 1,
    reviewedAt: row.reviewed_at,
  };
}

export function toReviewDto(row: ReviewRow): ReviewDto {
  return {
    id: row.id,
    itemId: row.itemId,
    reviewedOn: row.reviewedOn,
    confidence: row.confidence,
    stopBefore: row.stopBefore,
    stopAfter: row.stopAfter,
    wasDueOn: row.wasDueOn,
    nextDueOn: row.nextDueOn,
    manual: row.manual,
  };
}
