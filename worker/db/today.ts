import { and, asc, eq, lte, notInArray } from "drizzle-orm";
import { addDays, DEFAULT_LADDER, validateLadder, type IsoDate, type Ladder } from "../../src/core";
import type { ImageDto, ItemDto, ReviewDto, TodayResponse } from "../contract";
import type { Db } from "./client";
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
        .select({ ladderDays: settings.ladderDays })
        .from(settings)
        .where(eq(settings.userId, userId)),
      db
        .select({
          id: sections.id,
          name: sections.name,
          code: sections.code,
          line: sections.line,
          position: sections.position,
        })
        .from(sections)
        .where(eq(sections.userId, userId))
        .orderBy(asc(sections.position), asc(sections.id)),
      db.select().from(items).where(leftToday).orderBy(asc(items.id)),
      db
        .select({
          itemId: itemImages.itemId,
          key: itemImages.imageKey,
          side: itemImages.side,
          position: itemImages.position,
        })
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

  const imagesByItem = new Map<number, ImageDto[]>();
  for (const { itemId, ...image } of [...imageRows].sort(byImageOrder)) {
    imagesByItem.set(itemId, [...(imagesByItem.get(itemId) ?? []), image]);
  }

  return {
    date,
    ladder: [...checkedLadder(settingsRows[0]?.ladderDays)],
    sections: sectionRows,
    items: itemRows.map((row): ItemDto => ({
      id: row.id,
      sectionId: row.sectionId,
      name: row.name,
      description: row.description,
      problemUrl: row.problemUrl,
      problemText: row.problemText,
      answerUrl: row.answerUrl,
      answerText: row.answerText,
      sideNote: row.sideNote,
      stop: row.stop,
      dueOn: row.dueOn,
      images: imagesByItem.get(row.id) ?? [],
    })),
    reviewsToday: reviewRows.map(toReviewDto),
    tomorrow: { date: tomorrow, itemIds: tomorrowRows.map((row) => row.id) },
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

/** Problem images before answer images, each side in position order. */
function byImageOrder(a: ImageDto & { itemId: number }, b: ImageDto & { itemId: number }) {
  const side = (image: ImageDto) => (image.side === "problem" ? 0 : 1);
  return a.itemId - b.itemId || side(a) - side(b) || a.position - b.position;
}

function checkedLadder(stored: number[] | undefined): Ladder {
  const ladder = stored ?? DEFAULT_LADDER;
  const issues = validateLadder(ladder);
  if (issues.length > 0) throw new Error(`Stored ladder is invalid: ${JSON.stringify(issues)}`);
  return ladder;
}
