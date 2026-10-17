import { and, asc, count, countDistinct, eq } from "drizzle-orm";
import type { IsoDate, ItemImageInput, ItemText } from "../../src/core";
import type { ImageDto, ItemDto, ItemResponse, ItemSummaryDto } from "../contract";
import type { Db } from "./client";
import { itemImages, items, reviews, sections, type Item } from "./schema";

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

/** Problem images before answer images, each side in position order. */
export function byImageOrder(a: ImageDto & { itemId: number }, b: ImageDto & { itemId: number }) {
  const side = (image: ImageDto) => (image.side === "problem" ? 0 : 1);
  return a.itemId - b.itemId || side(a) - side(b) || a.position - b.position;
}

/** Image rows grouped by item, each item's in display order. */
export function imagesByItem(rows: (ImageDto & { itemId: number })[]): Map<number, ImageDto[]> {
  const grouped = new Map<number, ImageDto[]>();
  for (const { itemId, ...image } of [...rows].sort(byImageOrder)) {
    grouped.set(itemId, [...(grouped.get(itemId) ?? []), image]);
  }
  return grouped;
}

export function toItemDto(row: Item, images: ImageDto[]): ItemDto {
  return {
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
    images,
  };
}

export const imageColumns = {
  itemId: itemImages.itemId,
  key: itemImages.imageKey,
  side: itemImages.side,
  position: itemImages.position,
};

/** Every item of the person's for the Items list, oldest first, flagged if reviewed on `date`. */
export async function loadItemList(
  db: Db,
  userId: number,
  date: IsoDate,
): Promise<ItemSummaryDto[]> {
  const [itemRows, reviewRows] = await db.batch([
    db
      .select({
        id: items.id,
        sectionId: items.sectionId,
        name: items.name,
        description: items.description,
        problemText: items.problemText,
        sideNote: items.sideNote,
        stop: items.stop,
        dueOn: items.dueOn,
      })
      .from(items)
      .where(eq(items.userId, userId))
      .orderBy(asc(items.id)),
    db
      .select({ itemId: reviews.itemId })
      .from(reviews)
      .where(and(eq(reviews.userId, userId), eq(reviews.reviewedOn, date))),
  ]);
  const reviewed = new Set(reviewRows.map((row) => row.itemId));
  return itemRows.map((row) => ({ ...row, reviewedToday: reviewed.has(row.id) }));
}

/** One item of the person's with its images and review count, or null. */
export async function loadItem(
  db: Db,
  userId: number,
  itemId: number,
): Promise<ItemResponse | null> {
  const owned = and(eq(items.id, itemId), eq(items.userId, userId));
  const [itemRows, imageRows, reviewRows] = await db.batch([
    db.select().from(items).where(owned),
    db
      .select(imageColumns)
      .from(itemImages)
      .innerJoin(items, eq(items.id, itemImages.itemId))
      .where(owned),
    db.select({ n: count() }).from(reviews).where(eq(reviews.itemId, itemId)),
  ]);
  const [row] = itemRows;
  if (!row) return null;
  return {
    item: toItemDto(row, imagesByItem(imageRows).get(row.id) ?? []),
    reviews: reviewRows[0]?.n ?? 0,
  };
}

/** Whether a section is the person's. */
export async function ownsSection(db: Db, userId: number, sectionId: number): Promise<boolean> {
  const [row] = await db
    .select({ id: sections.id })
    .from(sections)
    .where(and(eq(sections.id, sectionId), eq(sections.userId, userId)));
  return !!row;
}

/**
 * How many different images the person would use if `itemId` (null for a new item) had `keys`:
 * their other items' images plus these, each counted once.
 */
export async function imagesInUse(
  db: Db,
  userId: number,
  itemId: number | null,
  keys: string[],
): Promise<number> {
  const row = await db.$client
    .prepare(
      `SELECT COUNT(*) AS n FROM (
         SELECT image_key FROM item_images JOIN items ON items.id = item_images.item_id
         WHERE items.user_id = ?1 AND items.id IS NOT ?2
         UNION SELECT value FROM json_each(?3)
       )`,
    )
    .bind(userId, itemId, JSON.stringify(keys))
    .first<{ n: number }>();
  return row?.n ?? 0;
}

/** How many different images the person's items use. */
export async function countImages(db: Db, userId: number): Promise<number> {
  const [row] = await db
    .select({ n: countDistinct(itemImages.imageKey) })
    .from(itemImages)
    .innerJoin(items, eq(items.id, itemImages.itemId))
    .where(eq(items.userId, userId));
  return row?.n ?? 0;
}

type Fields = ItemText & { sectionId: number };
type ImageRow = ItemImageInput & { position: number };

/**
 * A new item on stop 1, due `date`, with its images, in one D1 batch. Inside the batch no other
 * write can come between, so the person's newest item is the one just added.
 */
export async function insertItem(
  db: Db,
  userId: number,
  fields: Fields,
  images: ImageRow[],
  date: IsoDate,
): Promise<number> {
  const d1 = db.$client;
  const [inserted] = await d1.batch<{ id: number }>([
    d1
      .prepare(
        `INSERT INTO items (user_id, section_id, name, description, problem_url, problem_text,
           answer_url, answer_text, side_note, stop, due_on)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 1, ?10)
         RETURNING id`,
      )
      .bind(userId, ...fieldValues(fields), date),
    d1
      .prepare(
        `INSERT INTO item_images (item_id, side, image_key, position)
         SELECT (SELECT MAX(id) FROM items WHERE user_id = ?1),
           json_extract(value, '$.side'), json_extract(value, '$.key'), json_extract(value, '$.position')
         FROM json_each(?2)`,
      )
      .bind(userId, JSON.stringify(images)),
  ]);
  const id = inserted?.results[0]?.id;
  if (id === undefined) throw new Error("item not created");
  return id;
}

/**
 * Saves every field and replaces the image list, in one D1 batch. The stop and due date are left
 * as they are. Returns false if the item isn't the person's.
 */
export async function updateItem(
  db: Db,
  userId: number,
  itemId: number,
  fields: Fields,
  images: ImageRow[],
): Promise<boolean> {
  const d1 = db.$client;
  const owned = "EXISTS (SELECT 1 FROM items WHERE id = ?1 AND user_id = ?2)";
  const [updated] = await d1.batch<{ id: number }>([
    d1
      .prepare(
        `UPDATE items SET section_id = ?3, name = ?4, description = ?5, problem_url = ?6,
           problem_text = ?7, answer_url = ?8, answer_text = ?9, side_note = ?10, updated_at = ${NOW}
         WHERE id = ?1 AND user_id = ?2
         RETURNING id`,
      )
      .bind(itemId, userId, ...fieldValues(fields)),
    d1.prepare(`DELETE FROM item_images WHERE item_id = ?1 AND ${owned}`).bind(itemId, userId),
    d1
      .prepare(
        `INSERT INTO item_images (item_id, side, image_key, position)
         SELECT ?1, json_extract(value, '$.side'), json_extract(value, '$.key'), json_extract(value, '$.position')
         FROM json_each(?3) WHERE ${owned}`,
      )
      .bind(itemId, userId, JSON.stringify(images)),
  ]);
  return (updated?.results.length ?? 0) > 0;
}

/** Deletes an item; its images and reviews go with it. Returns false if it isn't the person's. */
export async function deleteItem(db: Db, userId: number, itemId: number): Promise<boolean> {
  const deleted = await db
    .delete(items)
    .where(and(eq(items.id, itemId), eq(items.userId, userId)))
    .returning({ id: items.id });
  return deleted.length > 0;
}

function fieldValues(fields: Fields) {
  return [
    fields.sectionId,
    fields.name,
    fields.description,
    fields.problemUrl,
    fields.problemText,
    fields.answerUrl,
    fields.answerText,
    fields.sideNote,
  ];
}
