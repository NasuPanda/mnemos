import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Timestamps are UTC ISO strings. Calendar dates (due_on, reviewed_on) will be plain YYYY-MM-DD.
const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

/** One row per person, created on first login from the Access email (stored lowercase). */
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  createdAt: text("created_at").notNull().default(now),
});

export type User = typeof users.$inferSelect;
