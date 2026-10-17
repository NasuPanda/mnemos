import { and, asc, eq, lte, notInArray } from "drizzle-orm";
import {
  addDays,
  DEFAULT_LADDER,
  FIRST_LINE,
  validateLadder,
  type IsoDate,
  type Ladder,
} from "../../src/core";
import type { ReviewDto, TodayResponse } from "../contract";
import type { Db } from "./client";
import { imageColumns, imagesByItem, toItemDto } from "./items";
import { sectionColumns } from "./sections";
import { itemImages, items, reviews, sections, settings, type ReviewRow } from "./schema";

/** The person's ladder from their settings; the default when they have none yet. */
export async function loadLadder(db: Db, userId: number): Promise<Ladder> {
  const [row] = await db
    .select({ ladderDays: settings.ladderDays })
    .from(settings)
    .where(eq(settings.userId, userId));
  return checkedLadder(row?.ladderDays);
}

/**
 * Everything the dashboard, a review run and All done need for `date`, in one D1 round trip:
 * the ladder, the sections, the items left today with their content and images, today's
 * reviews and tomorrow's due items. Every query is scoped to `userId`.
 */
export async function loadToday(db: Db, userId: number, date: IsoDate): Promise<TodayResponse> {
  const tomorrow = addDays(date, 1);
  const reviewedToday = db
    .select({ id: reviews.itemId })
    .from(reviews)
    .where(and(eq(reviews.userId, userId), eq(reviews.reviewedOn, date)));
  const leftToday = and(
    eq(items.userId, userId),
    lte(items.dueOn, date),
    notInArray(items.id, reviewedToday),
  );

  const [settingsRows, sectionRows, itemRows, imageRows, reviewRows, tomorrowRows] = await db.batch(
    [
      db
        .select({ ladderDays: settings.ladderDays, nextLine: settings.nextLine })
        .from(settings)
        .where(eq(settings.userId, userId)),
      db
        .select(sectionColumns)
        .from(sections)
        .where(eq(sections.userId, userId))
        .orderBy(asc(sections.position), asc(sections.id)),
      db.select().from(items).where(leftToday).orderBy(asc(items.id)),
      db
        .select(imageColumns)
        .from(itemImages)
        .innerJoin(items, eq(items.id, itemImages.itemId))
        .where(leftToday),
      db
        .select()
        .from(reviews)
        .where(and(eq(reviews.userId, userId), eq(reviews.reviewedOn, date)))
        .orderBy(asc(reviews.id)),
      db
        .select({ id: items.id })
        .from(items)
        .where(and(eq(items.userId, userId), eq(items.dueOn, tomorrow)))
        .orderBy(asc(items.id)),
    ],
  );

  const images = imagesByItem(imageRows);

  return {
    date,
    ladder: [...checkedLadder(settingsRows[0]?.ladderDays)],
    sections: sectionRows,
    items: itemRows.map((row) => toItemDto(row, images.get(row.id) ?? [])),
    reviewsToday: reviewRows.map(toReviewDto),
    tomorrow: { date: tomorrow, itemIds: tomorrowRows.map((row) => row.id) },
    nextLine: settingsRows[0]?.nextLine ?? FIRST_LINE,
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

function checkedLadder(stored: number[] | undefined): Ladder {
  const ladder = stored ?? DEFAULT_LADDER;
  const issues = validateLadder(ladder);
  if (issues.length > 0) throw new Error(`Stored ladder is invalid: ${JSON.stringify(issues)}`);
  return ladder;
}
