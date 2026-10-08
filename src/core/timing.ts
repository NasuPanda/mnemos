import { daysBetween, type IsoDate } from "./dates";

/**
 * How late an item is on `today`: today minus its due date ("+3 days"). An item due today, or
 * later, is 0 days late and shows no delay.
 */
export function daysLate(dueOn: IsoDate, today: IsoDate): number {
  return Math.max(0, daysBetween(dueOn, today));
}

export type ReviewTiming =
  { kind: "on-time" } | { kind: "early"; days: number } | { kind: "late"; days: number };

/**
 * When a review happened compared with the date the item was due, for the history's marks
 * ("1 day early"). Reviews made early or late are otherwise like any other.
 */
export function reviewTiming(review: { reviewedOn: IsoDate; wasDueOn: IsoDate }): ReviewTiming {
  const days = daysBetween(review.wasDueOn, review.reviewedOn);
  if (days < 0) return { kind: "early", days: -days };
  if (days > 0) return { kind: "late", days };
  return { kind: "on-time" };
}
