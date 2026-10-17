import { and, asc, eq, gt, gte, lt, lte } from "drizzle-orm";
import { compareDates, weekOf, type IsoDate } from "../../src/core";
import type { DayResponse } from "../contract";
import type { Db } from "./client";
import { imageColumns, imagesByItem, toItemDto } from "./items";
import { toReviewDto } from "./today";
import { itemImages, items, reviews } from "./schema";

/**
 * Another day for the dashboard, in one D1 round trip through the (user_id, due_on) and
 * (user_id, reviewed_on) indexes: what the week strip counts, plus a future day's items with
 * their content and images, or a past day's reviews. Missed items never show on a past day.
 * Every query is scoped to `userId`.
 */
export async function loadDay(
  db: Db,
  userId: number,
  date: IsoDate,
  today: IsoDate,
): Promise<DayResponse> {
  const days = weekOf(date);
  const monday = days[0] as IsoDate;
  const sunday = days[6] as IsoDate;

  const weekQueries = [
    db
      .select({ id: items.id, dueOn: items.dueOn })
      .from(items)
      .where(
        and(
          eq(items.userId, userId),
          gt(items.dueOn, today),
          gte(items.dueOn, monday),
          lte(items.dueOn, sunday),
        ),
      )
      .orderBy(asc(items.dueOn), asc(items.id)),
    db
      .select({ itemId: reviews.itemId, reviewedOn: reviews.reviewedOn })
      .from(reviews)
      .where(
        and(
          eq(reviews.userId, userId),
          lt(reviews.reviewedOn, today),
          gte(reviews.reviewedOn, monday),
          lte(reviews.reviewedOn, sunday),
        ),
      )
      .orderBy(asc(reviews.reviewedOn), asc(reviews.id)),
  ] as const;
  const base = { date, today, items: [], reviews: [] };
  const order = compareDates(date, today);

  if (order > 0) {
    const dueThatDay = and(eq(items.userId, userId), eq(items.dueOn, date));
    const [due, weekReviews, itemRows, imageRows] = await db.batch([
      ...weekQueries,
      db.select().from(items).where(dueThatDay).orderBy(asc(items.id)),
      db
        .select(imageColumns)
        .from(itemImages)
        .innerJoin(items, eq(items.id, itemImages.itemId))
        .where(dueThatDay),
    ]);
    const images = imagesByItem(imageRows);
    return {
      ...base,
      week: { days, due, reviews: weekReviews },
      items: itemRows.map((row) => toItemDto(row, images.get(row.id) ?? [])),
    };
  }

  if (order < 0) {
    const [due, weekReviews, reviewRows] = await db.batch([
      ...weekQueries,
      db
        .select({ review: reviews, name: items.name, sectionId: items.sectionId })
        .from(reviews)
        .innerJoin(items, eq(items.id, reviews.itemId))
        .where(and(eq(reviews.userId, userId), eq(reviews.reviewedOn, date)))
        .orderBy(asc(reviews.id)),
    ]);
    return {
      ...base,
      week: { days, due, reviews: weekReviews },
      reviews: reviewRows.map((row) => ({
        ...toReviewDto(row.review),
        name: row.name,
        sectionId: row.sectionId,
      })),
    };
  }

  const [due, weekReviews] = await db.batch([...weekQueries]);
  return { ...base, week: { days, due, reviews: weekReviews } };
}
