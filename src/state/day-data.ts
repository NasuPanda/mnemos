import {
  compareDates,
  futureDayCounts,
  futureDayList,
  pastDayList,
  stripCount,
  type DayEntry,
  type IsoDate,
  type StripCount,
} from "@/core";
import type { DayResponse, ItemDto, PastReviewDto, SectionDto } from "../../worker/contract";

/**
 * The client's copy of another day (GET /api/days/:date). Ratings and Undo change it at once,
 * with these pure functions; the counts and order come from src/core.
 */
export type DayData = DayResponse;

export type DayKind = "past" | "today" | "future";

export function dayKind(day: IsoDate, today: IsoDate): DayKind {
  const order = compareDates(day, today);
  return order < 0 ? "past" : order > 0 ? "future" : "today";
}

/**
 * An item that has moved, by a rating or by Undo: it leaves the week's count and the day's list
 * where it was, and joins them where it is now. A future day keeps an item rated today that lands
 * on it again; it shows dimmed there.
 */
export function withMovedItem(data: DayData, item: ItemDto): DayData {
  const due = data.week.due.filter((row) => row.id !== item.id);
  if (data.week.days.includes(item.dueOn) && compareDates(item.dueOn, data.today) > 0) {
    due.push({ id: item.id, dueOn: item.dueOn });
    due.sort((a, b) => compareDates(a.dueOn, b.dueOn) || a.id - b.id);
  }
  const items = data.items.filter((i) => i.id !== item.id);
  if (dayKind(data.date, data.today) === "future" && item.dueOn === data.date) {
    items.push(item);
    items.sort((a, b) => a.id - b.id);
  }
  return { ...data, week: { ...data.week, due }, items };
}

/** A deleted item: gone from the day, the week's counts and its reviews on a past day. */
export function withoutDayItem(data: DayData, itemId: number): DayData {
  return {
    ...data,
    week: {
      ...data.week,
      due: data.week.due.filter((row) => row.id !== itemId),
      reviews: data.week.reviews.filter((row) => row.itemId !== itemId),
    },
    items: data.items.filter((item) => item.id !== itemId),
    reviews: data.reviews.filter((review) => review.itemId !== itemId),
  };
}

export type StripDay = { date: IsoDate; count: StripCount };

/**
 * The week strip: what each of the seven days shows. Past days count their reviews, future days
 * their items due; today shows today's Left, which only today's own data knows.
 */
export function stripDays(week: DayData["week"], today: IsoDate, todayLeft: number): StripDay[] {
  const items = week.due.map((row) => ({ ...row, sectionId: 0 }));
  return week.days.map((date) => ({
    date,
    count:
      date === today
        ? { kind: "today", left: todayLeft }
        : stripCount(date, today, { items, reviews: week.reviews }),
  }));
}

export type LineCounts = { due: number; reviewedToday: number; early: number };

export type FutureDayView = {
  counts: LineCounts;
  /** That day's items in dashboard order; the ones reviewed today come last in their line. */
  list: DayEntry<ItemDto>[];
  /** Due, reviewed today and Early per section id. */
  lines: Map<number, LineCounts>;
};

/** A future day: its items due, which of them were reviewed today, and Review early's count. */
export function futureDayView(
  data: DayData,
  sections: readonly SectionDto[],
  reviewedToday: ReadonlySet<number>,
): FutureDayView {
  const items = knownSections(data.items, sections);
  const lines = new Map<number, LineCounts>();
  for (const section of sections) {
    const own = items.filter((item) => item.sectionId === section.id);
    if (own.length > 0) {
      lines.set(section.id, futureDayCounts(own, reviewedToday, data.date, data.today));
    }
  }
  return {
    counts: futureDayCounts(items, reviewedToday, data.date, data.today),
    list: futureDayList(items, sections, reviewedToday, data.date, data.today),
    lines,
  };
}

/** A past day: only the reviews made that day, in dashboard order. */
export function pastDayView(data: DayData, sections: readonly SectionDto[]): PastReviewDto[] {
  return pastDayList(knownSections(data.reviews, sections), sections);
}

/**
 * Leaves out rows whose section isn't in the list yet, for the moment after a section change
 * when the day's data and today's sections come from different requests.
 */
function knownSections<T extends { sectionId: number }>(
  rows: readonly T[],
  sections: readonly SectionDto[],
): T[] {
  const ids = new Set(sections.map((section) => section.id));
  return rows.filter((row) => ids.has(row.sectionId));
}
