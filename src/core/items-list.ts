import { compareDates, type IsoDate } from "./dates";
import type { ScheduledItem } from "./day";
import { daysLate } from "./timing";

/** An item as the Items list sees it: its schedule, and whether it has a review dated today. */
export type ListedItem = ScheduledItem & { reviewedToday: boolean };

/**
 * A row's status: "+3 days" for a late item, "Due today", "Reviewed today", or nothing for an
 * item due on a later day. A reviewed item has already moved to a later date, so "Reviewed
 * today" wins.
 */
export type ItemStatus =
  | { kind: "late"; days: number }
  | { kind: "due-today" }
  | { kind: "reviewed-today" }
  | { kind: "scheduled" };

export function itemStatus(item: ListedItem, today: IsoDate): ItemStatus {
  if (item.reviewedToday) return { kind: "reviewed-today" };
  const order = compareDates(item.dueOn, today);
  if (order < 0) return { kind: "late", days: daysLate(item.dueOn, today) };
  if (order === 0) return { kind: "due-today" };
  return { kind: "scheduled" };
}

export type ItemSort = "next-due" | "recently-added";
export const ITEM_SORTS: readonly ItemSort[] = ["next-due", "recently-added"];

/**
 * The Items list's orders. Next due: the earliest due date first, so late items lead; equal
 * dates in creation order, oldest first. Recently added: the newest item first.
 */
export function sortItems<T extends ScheduledItem>(items: readonly T[], sort: ItemSort): T[] {
  const sorted = [...items];
  if (sort === "recently-added") return sorted.sort((a, b) => b.id - a.id);
  return sorted.sort((a, b) => compareDates(a.dueOn, b.dueOn) || a.id - b.id);
}

/**
 * The line above the list: "23 items · 3 late · 5 more due today · 1 reviewed today". Late and
 * "more due today" split Left the same way as everywhere else: Late is the part due before
 * today, and together they make Left, never more.
 */
export function listCounts(
  items: readonly ListedItem[],
  today: IsoDate,
): { items: number; late: number; dueToday: number; reviewedToday: number } {
  const counts = { items: items.length, late: 0, dueToday: 0, reviewedToday: 0 };
  for (const item of items) {
    const status = itemStatus(item, today);
    if (status.kind === "late") counts.late++;
    else if (status.kind === "due-today") counts.dueToday++;
    else if (status.kind === "reviewed-today") counts.reviewedToday++;
  }
  return counts;
}
