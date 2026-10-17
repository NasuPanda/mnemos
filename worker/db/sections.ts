import { and, asc, eq } from "drizzle-orm";
import { FIRST_LINE, type Line } from "../../src/core";
import type { SectionDto } from "../contract";
import type { Db } from "./client";
import { sections, settings } from "./schema";

/** The columns the app sees for a section. */
export const sectionColumns = {
  id: sections.id,
  name: sections.name,
  code: sections.code,
  line: sections.line,
  position: sections.position,
};

/** The person's sections in their order, and the colour the next new one gets. */
export async function loadSections(
  db: Db,
  userId: number,
): Promise<{ sections: SectionDto[]; nextLine: Line }> {
  const [sectionRows, settingsRows] = await db.batch([
    db
      .select(sectionColumns)
      .from(sections)
      .where(eq(sections.userId, userId))
      .orderBy(asc(sections.position), asc(sections.id)),
    db.select({ nextLine: settings.nextLine }).from(settings).where(eq(settings.userId, userId)),
  ]);
  return { sections: sectionRows, nextLine: settingsRows[0]?.nextLine ?? FIRST_LINE };
}

/**
 * Adds a section at the end of the person's order with colour `line`, and moves their colour
 * counter on to `nextLine`, in one D1 batch. Both happen only if the counter still reads `line`;
 * if another request moved it meanwhile, nothing changes and this returns null.
 */
export async function insertSection(
  db: Db,
  userId: number,
  section: { name: string; code: string; line: Line; nextLine: Line },
): Promise<SectionDto | null> {
  const d1 = db.$client;
  const [inserted] = await d1.batch<SectionDto>([
    d1
      .prepare(
        `INSERT INTO sections (user_id, name, code, line, position)
         SELECT ?1, ?2, ?3, ?4, (SELECT COALESCE(MAX(position), 0) + 1 FROM sections WHERE user_id = ?1)
         WHERE EXISTS (SELECT 1 FROM settings WHERE user_id = ?1 AND next_line = ?4)
         RETURNING id, name, code, line, position`,
      )
      .bind(userId, section.name, section.code, section.line),
    d1
      .prepare("UPDATE settings SET next_line = ?3 WHERE user_id = ?1 AND next_line = ?2")
      .bind(userId, section.line, section.nextLine),
  ]);
  return inserted?.results[0] ?? null;
}

/** Renames a section or changes its code; null if it isn't one of the person's. */
export async function updateSection(
  db: Db,
  userId: number,
  sectionId: number,
  change: { name?: string; code?: string },
): Promise<SectionDto | null> {
  const [row] = await db
    .update(sections)
    .set(change)
    .where(and(eq(sections.id, sectionId), eq(sections.userId, userId)))
    .returning(sectionColumns);
  return row ?? null;
}

/** Puts the person's sections in the order of `ids`, in one statement whatever their number. */
export async function reorderSections(db: Db, userId: number, ids: number[]): Promise<void> {
  await db.$client
    .prepare(
      `UPDATE sections
       SET position = (SELECT CAST(key AS INTEGER) + 1 FROM json_each(?2) WHERE value = sections.id)
       WHERE user_id = ?1 AND id IN (SELECT value FROM json_each(?2))`,
    )
    .bind(userId, JSON.stringify(ids))
    .run();
}

/**
 * Deletes a section with its items, in one D1 batch; the items' images and reviews go with them
 * (ON DELETE CASCADE). Returns how many items went, or null if the section isn't the person's.
 */
export async function deleteSection(
  db: Db,
  userId: number,
  sectionId: number,
): Promise<number | null> {
  const d1 = db.$client;
  const [deletedItems, deletedSection] = await d1.batch<{ id: number }>([
    d1
      .prepare("DELETE FROM items WHERE section_id = ?2 AND user_id = ?1 RETURNING id")
      .bind(userId, sectionId),
    d1
      .prepare("DELETE FROM sections WHERE id = ?2 AND user_id = ?1 RETURNING id")
      .bind(userId, sectionId),
  ]);
  if ((deletedSection?.results.length ?? 0) === 0) return null;
  return deletedItems?.results.length ?? 0;
}
