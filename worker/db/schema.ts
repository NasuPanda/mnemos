import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

// Timestamps are UTC ISO strings. Calendar dates (due_on, reviewed_on) are plain YYYY-MM-DD.
const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

const LINES = ["m2", "m3", "m4"] as const;
const SIDES = ["problem", "answer"] as const;
const CONFIDENCES = ["confident", "neutral", "not_at_all"] as const;

/** One row per person, created on first login from the Access email (stored lowercase). */
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  createdAt: text("created_at").notNull().default(now),
});

/**
 * One row per person. ladder_days is the JSON list of gaps; next_line is the colour counter for
 * the next new section, which only moves forward.
 */
export const settings = sqliteTable(
  "settings",
  {
    userId: integer("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    ladderDays: text("ladder_days", { mode: "json" })
      .$type<number[]>()
      .notNull()
      .default(sql`'[1,2,3,5,7,14,28]'`),
    nextLine: text("next_line", { enum: LINES }).notNull().default("m2"),
  },
  (t) => [check("settings_next_line", sql`${t.nextLine} IN ('m2', 'm3', 'm4')`)],
);

/** A named group of items, drawn as a metro line. line is set once at creation. */
export const sections = sqliteTable(
  "sections",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    code: text("code").notNull(),
    line: text("line", { enum: LINES }).notNull(),
    position: integer("position").notNull(),
  },
  (t) => [
    uniqueIndex("sections_user_code").on(t.userId, t.code),
    index("sections_user_position").on(t.userId, t.position),
    check("sections_line", sql`${t.line} IN ('m2', 'm3', 'm4')`),
  ],
);

/** One thing to study. id grows with creation, so it gives the creation order. */
export const items = sqliteTable(
  "items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sectionId: integer("section_id")
      .notNull()
      .references(() => sections.id),
    name: text("name").notNull(),
    description: text("description"),
    problemUrl: text("problem_url"),
    problemText: text("problem_text"),
    answerUrl: text("answer_url"),
    answerText: text("answer_text"),
    sideNote: text("side_note"),
    stop: integer("stop").notNull().default(1),
    dueOn: text("due_on").notNull(),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (t) => [
    index("items_user_due").on(t.userId, t.dueOn),
    index("items_section").on(t.sectionId),
    check("items_stop", sql`${t.stop} >= 1`),
  ],
);

/** An item's images, in order, on the problem or the answer side. */
export const itemImages = sqliteTable(
  "item_images",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    itemId: integer("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    side: text("side", { enum: SIDES }).notNull(),
    imageKey: text("image_key").notNull(),
    position: integer("position").notNull(),
  },
  (t) => [
    index("item_images_item").on(t.itemId),
    index("item_images_key").on(t.imageKey),
    check("item_images_side", sql`${t.side} IN ('problem', 'answer')`),
  ],
);

/** One review per item per day. stop_before and was_due_on let Undo restore the item. */
export const reviews = sqliteTable(
  "reviews",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    itemId: integer("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    reviewedOn: text("reviewed_on").notNull(),
    confidence: text("confidence", { enum: CONFIDENCES }).notNull(),
    stopBefore: integer("stop_before").notNull(),
    stopAfter: integer("stop_after").notNull(),
    wasDueOn: text("was_due_on").notNull(),
    nextDueOn: text("next_due_on").notNull(),
    manual: integer("manual", { mode: "boolean" }).notNull().default(false),
    reviewedAt: text("reviewed_at").notNull().default(now),
  },
  (t) => [
    uniqueIndex("reviews_item_day").on(t.itemId, t.reviewedOn),
    index("reviews_user_day").on(t.userId, t.reviewedOn),
    check("reviews_confidence", sql`${t.confidence} IN ('confident', 'neutral', 'not_at_all')`),
  ],
);

export type User = typeof users.$inferSelect;
export type Settings = typeof settings.$inferSelect;
export type Section = typeof sections.$inferSelect;
export type Item = typeof items.$inferSelect;
export type ItemImage = typeof itemImages.$inferSelect;
export type ReviewRow = typeof reviews.$inferSelect;
