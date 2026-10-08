import { compareDates, type IsoDate } from "./dates";
import { daysLate } from "./timing";

/**
 * The scheduling fields of an item. `id` grows with creation (AUTOINCREMENT), so ordering by id
 * is creation order, oldest first.
 */
export type ScheduledItem = { id: number; sectionId: number; dueOn: IsoDate };

/** A section's place in the person's section order. */
export type SectionRef = { id: number; position: number };

/** The ids of items that have a review dated today. */
export type ReviewedToday = ReadonlySet<number>;

export type DayEntry<T extends ScheduledItem> = {
  item: T;
  daysLate: number;
  /** Dimmed and skipped by J/K on a future day. */
  reviewedToday: boolean;
};

/**
 * Today's list: items due today or earlier that haven't been reviewed today, in the dashboard
 * and flash review order: sections in section order; within a section the most days late first,
 * then the ones due today; equally late items in creation order, oldest first.
 */
export function todayList<T extends ScheduledItem>(
  items: readonly T[],
  sections: readonly SectionRef[],
  reviewedToday: ReviewedToday,
  today: IsoDate,
): DayEntry<T>[] {
  const entries = items
    .filter((item) => isLeft(item, reviewedToday, today))
    .map((item) => ({ item, daysLate: daysLate(item.dueOn, today), reviewedToday: false }));
  return inSectionOrder(
    entries,
    sections,
    (a, b) => b.daysLate - a.daysLate || a.item.id - b.item.id,
  );
}

/**
 * A future day's list: the items due that day. Those already reviewed today come last in their
 * section; otherwise the order is section order, then creation order, oldest first.
 */
export function futureDayList<T extends ScheduledItem>(
  items: readonly T[],
  sections: readonly SectionRef[],
  reviewedToday: ReviewedToday,
  day: IsoDate,
  today: IsoDate,
): DayEntry<T>[] {
  assertFuture(day, today);
  const entries = items
    .filter((item) => item.dueOn === day)
    .map((item) => ({ item, daysLate: 0, reviewedToday: reviewedToday.has(item.id) }));
  return inSectionOrder(
    entries,
    sections,
    (a, b) => Number(a.reviewedToday) - Number(b.reviewedToday) || a.item.id - b.item.id,
  );
}

/** Sorts entries by their section's position, then by `withinSection`. */
function inSectionOrder<T extends ScheduledItem>(
  entries: DayEntry<T>[],
  sections: readonly SectionRef[],
  withinSection: (a: DayEntry<T>, b: DayEntry<T>) => number,
): DayEntry<T>[] {
  const rank = sectionRank(sections);
  return entries
    .map((entry) => ({ entry, rank: rankOf(rank, entry.item) }))
    .sort((a, b) => a.rank - b.rank || withinSection(a.entry, b.entry))
    .map(({ entry }) => entry);
}

export type QueueOptions = {
  sections: readonly SectionRef[];
  reviewedToday: ReviewedToday;
  today: IsoDate;
  /** A future day to review early; today when left out. */
  day?: IsoDate;
  /** Only this section's items (Shift+F, review this line). */
  sectionId?: number;
};

/**
 * The items a review run goes through, in the dashboard's order: today's Left items, or a future
 * day's items not yet reviewed today (Review early). Optionally only one section's.
 */
export function reviewQueue<T extends ScheduledItem>(
  items: readonly T[],
  options: QueueOptions,
): T[] {
  const { sections, reviewedToday, today, day = today, sectionId } = options;
  const entries =
    day === today
      ? todayList(items, sections, reviewedToday, today)
      : futureDayList(items, sections, reviewedToday, day, today).filter((e) => !e.reviewedToday);
  return entries
    .filter((entry) => sectionId === undefined || entry.item.sectionId === sectionId)
    .map((entry) => entry.item);
}

/**
 * Today's summary line. Left: items due today or earlier not reviewed today. Late: the part of
 * Left due before today, never added on top. Done: reviews made today, early ones included.
 */
export function todayCounts(
  items: readonly ScheduledItem[],
  reviewsToday: readonly { itemId: number }[],
  today: IsoDate,
): { left: number; late: number; done: number } {
  const reviewed = new Set(reviewsToday.map((review) => review.itemId));
  const left = items.filter((item) => isLeft(item, reviewed, today));
  return {
    left: left.length,
    late: left.filter((item) => compareDates(item.dueOn, today) < 0).length,
    done: reviewsToday.length,
  };
}

/**
 * A future day's counts. Due: items scheduled that day, including ones already reviewed today.
 * Early: Due minus those, the Review early count.
 */
export function futureDayCounts(
  items: readonly ScheduledItem[],
  reviewedToday: ReviewedToday,
  day: IsoDate,
  today: IsoDate,
): { due: number; reviewedToday: number; early: number } {
  assertFuture(day, today);
  const due = items.filter((item) => item.dueOn === day);
  const reviewed = due.filter((item) => reviewedToday.has(item.id)).length;
  return { due: due.length, reviewedToday: reviewed, early: due.length - reviewed };
}

/** Line: Left for each section, keyed by section id; sections with nothing left are absent. */
export function lineCounts(
  items: readonly ScheduledItem[],
  reviewedToday: ReviewedToday,
  today: IsoDate,
): Map<number, number> {
  const counts = new Map<number, number>();
  for (const item of items) {
    if (isLeft(item, reviewedToday, today)) {
      counts.set(item.sectionId, (counts.get(item.sectionId) ?? 0) + 1);
    }
  }
  return counts;
}

export type StripCount =
  | { kind: "past"; done: number }
  | { kind: "today"; left: number }
  | { kind: "future"; due: number };

/**
 * The number under a day in the week strip: reviews done on a past day (missed items don't
 * count there), items left today, items due on a future day.
 */
export function stripCount(
  day: IsoDate,
  today: IsoDate,
  data: {
    items: readonly ScheduledItem[];
    reviews: readonly { itemId: number; reviewedOn: IsoDate }[];
  },
): StripCount {
  const order = compareDates(day, today);
  if (order < 0) {
    return { kind: "past", done: data.reviews.filter((r) => r.reviewedOn === day).length };
  }
  if (order === 0) {
    const reviewsToday = data.reviews.filter((r) => r.reviewedOn === today);
    return { kind: "today", left: todayCounts(data.items, reviewsToday, today).left };
  }
  return { kind: "future", due: data.items.filter((item) => item.dueOn === day).length };
}

function isLeft(item: ScheduledItem, reviewedToday: ReviewedToday, today: IsoDate): boolean {
  return compareDates(item.dueOn, today) <= 0 && !reviewedToday.has(item.id);
}

function sectionRank(sections: readonly SectionRef[]): Map<number, number> {
  const ordered = [...sections].sort((a, b) => a.position - b.position || a.id - b.id);
  return new Map(ordered.map((section, index) => [section.id, index]));
}

function rankOf(rank: Map<number, number>, item: ScheduledItem): number {
  const value = rank.get(item.sectionId);
  if (value === undefined)
    throw new RangeError(`Item ${item.id} has unknown section ${item.sectionId}`);
  return value;
}

function assertFuture(day: IsoDate, today: IsoDate): void {
  if (compareDates(day, today) <= 0) throw new RangeError(`${day} is not after today (${today})`);
}
