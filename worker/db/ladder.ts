import { lowestStopMovedDown, type Ladder } from "../../src/core";
import type { Db } from "./client";

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";
/** The person's ladder is still the one the change started from. */
const UNCHANGED = "user_id = ?1 AND json(ladder_days) = json(?2)";

/**
 * Saves a new ladder (a gap changed, or a stop added) if the stored one is still `from`.
 * Returns whether it was saved. Items are untouched: their due dates stay as they are.
 */
export async function saveLadder(
  db: Db,
  userId: number,
  from: Ladder,
  to: Ladder,
): Promise<boolean> {
  const result = await db.$client
    .prepare(`UPDATE settings SET ladder_days = json(?3) WHERE ${UNCHANGED}`)
    .bind(userId, JSON.stringify(from), JSON.stringify(to))
    .run();
  return result.meta.changes > 0;
}

/**
 * Removes stop `removed` in one D1 batch: the items move (`stop = stop − 1` where
 * `stop ≥ max(removed, 2)`), then the new ladder is saved. Both happen only if the stored ladder
 * is still `from`, so two tabs can't remove a stop twice. Due dates stay as they are.
 */
export async function removeStopAndMoveItems(
  db: Db,
  userId: number,
  from: Ladder,
  to: Ladder,
  removed: number,
): Promise<boolean> {
  const d1 = db.$client;
  const fromJson = JSON.stringify(from);
  const [, saved] = await d1.batch([
    d1
      .prepare(
        `UPDATE items SET stop = stop - 1, updated_at = ${NOW}
         WHERE user_id = ?1 AND stop >= ?3
         AND EXISTS (SELECT 1 FROM settings WHERE ${UNCHANGED})`,
      )
      .bind(userId, fromJson, lowestStopMovedDown(removed)),
    d1
      .prepare(`UPDATE settings SET ladder_days = json(?3) WHERE ${UNCHANGED}`)
      .bind(userId, fromJson, JSON.stringify(to)),
  ]);
  return (saved?.meta.changes ?? 0) > 0;
}
