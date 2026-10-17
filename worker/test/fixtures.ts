import { env } from "cloudflare:test";

/** Small helpers that write rows straight into the test database. */

export async function addSection(
  userId: number,
  section: { code: string; name?: string; line?: "m2" | "m3" | "m4"; position?: number },
): Promise<number> {
  const row = await env.DB.prepare(
    "INSERT INTO sections (user_id, name, code, line, position) VALUES (?, ?, ?, ?, ?) RETURNING id",
  )
    .bind(
      userId,
      section.name ?? `Section ${section.code}`,
      section.code,
      section.line ?? "m2",
      section.position ?? 1,
    )
    .first<{ id: number }>();
  if (!row) throw new Error("section not created");
  return row.id;
}

export async function addItem(
  userId: number,
  sectionId: number,
  item: { name: string; dueOn: string; stop?: number; answerText?: string },
): Promise<number> {
  const row = await env.DB.prepare(
    "INSERT INTO items (user_id, section_id, name, stop, due_on, answer_text) VALUES (?, ?, ?, ?, ?, ?) RETURNING id",
  )
    .bind(userId, sectionId, item.name, item.stop ?? 1, item.dueOn, item.answerText ?? null)
    .first<{ id: number }>();
  if (!row) throw new Error("item not created");
  return row.id;
}

export async function addImage(
  itemId: number,
  image: { key: string; side: "problem" | "answer"; position: number },
): Promise<void> {
  await env.DB.prepare(
    "INSERT INTO item_images (item_id, side, image_key, position) VALUES (?, ?, ?, ?)",
  )
    .bind(itemId, image.side, image.key, image.position)
    .run();
}

export async function addReview(
  userId: number,
  itemId: number,
  review: {
    reviewedOn: string;
    nextDueOn: string;
    stopBefore?: number;
    stopAfter?: number;
    confidence?: "confident" | "neutral" | "not_at_all";
    /** The due date the item had; the review date when left out. */
    wasDueOn?: string;
    manual?: boolean;
  },
): Promise<number> {
  const row = await env.DB.prepare(
    `INSERT INTO reviews (user_id, item_id, reviewed_on, confidence, stop_before, stop_after, was_due_on, next_due_on, manual)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
  )
    .bind(
      userId,
      itemId,
      review.reviewedOn,
      review.confidence ?? "confident",
      review.stopBefore ?? 1,
      review.stopAfter ?? 2,
      review.wasDueOn ?? review.reviewedOn,
      review.nextDueOn,
      review.manual ? 1 : 0,
    )
    .first<{ id: number }>();
  if (!row) throw new Error("review not created");
  return row.id;
}

export async function itemState(itemId: number) {
  return env.DB.prepare("SELECT stop, due_on AS dueOn FROM items WHERE id = ?")
    .bind(itemId)
    .first<{ stop: number; dueOn: string }>();
}

export async function setLadder(userId: number, ladder: number[]): Promise<void> {
  await env.DB.prepare("UPDATE settings SET ladder_days = ? WHERE user_id = ?")
    .bind(JSON.stringify(ladder), userId)
    .run();
}

export async function storedLadder(userId: number): Promise<number[]> {
  const row = await env.DB.prepare("SELECT ladder_days AS ladder FROM settings WHERE user_id = ?")
    .bind(userId)
    .first<{ ladder: string }>();
  if (!row) throw new Error("settings row missing");
  return JSON.parse(row.ladder) as number[];
}
