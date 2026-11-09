import type { Db } from "./client";

/** When the person finished or skipped the first-run tutorial, or null if they haven't. */
export async function tutorialCompletedAt(db: Db, userId: number): Promise<string | null> {
  const row = await db.$client
    .prepare("SELECT tutorial_completed_at AS at FROM settings WHERE user_id = ?")
    .bind(userId)
    .first<{ at: string | null }>();
  return row?.at ?? null;
}

/** Marks the tutorial done now, once: a later call keeps the first time. */
export async function completeTutorial(db: Db, userId: number): Promise<void> {
  await db.$client
    .prepare(
      "UPDATE settings SET tutorial_completed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE user_id = ? AND tutorial_completed_at IS NULL",
    )
    .bind(userId)
    .run();
}
