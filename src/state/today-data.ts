import { futureDayCounts, lineCounts, todayCounts, todayList, type DayEntry } from "@/core";
import type { ItemDto, ReviewDto, TodayResponse } from "../../worker/contract";

/**
 * The client's copy of today. Ratings and Undo change it at once, before the Worker confirms,
 * using these pure functions; the counts and order come from src/core.
 */
export type TodayData = TodayResponse;

/** A rating applied: the item leaves today's list and the review counts as Done. */
export function applyRating(data: TodayData, item: ItemDto, review: ReviewDto): TodayData {
  return {
    ...data,
    items: data.items.filter((i) => i.id !== item.id),
    reviewsToday: [...data.reviewsToday, review],
    tomorrow:
      review.nextDueOn === data.tomorrow.date && !data.tomorrow.itemIds.includes(item.id)
        ? { ...data.tomorrow, itemIds: [...data.tomorrow.itemIds, item.id] }
        : data.tomorrow,
  };
}

/** The inverse of applyRating: for Undo, or when the Worker refuses a rating. */
export function revertRating(data: TodayData, item: ItemDto, reviewId: number): TodayData {
  const review = data.reviewsToday.find((r) => r.id === reviewId);
  const landedTomorrow = review?.nextDueOn === data.tomorrow.date;
  return {
    ...data,
    items: [...data.items.filter((i) => i.id !== item.id), item].sort((a, b) => a.id - b.id),
    reviewsToday: data.reviewsToday.filter((r) => r.id !== reviewId),
    tomorrow: landedTomorrow
      ? { ...data.tomorrow, itemIds: data.tomorrow.itemIds.filter((id) => id !== item.id) }
      : data.tomorrow,
  };
}

/** Swaps the temporary id of an optimistic review for the one the Worker stored. */
export function confirmReview(data: TodayData, tempId: number, review: ReviewDto): TodayData {
  return { ...data, reviewsToday: data.reviewsToday.map((r) => (r.id === tempId ? review : r)) };
}

export type TodayView = {
  counts: { left: number; late: number; done: number };
  /** Today's items in dashboard and flash review order. */
  list: DayEntry<ItemDto>[];
  /** Left per section id. */
  lines: Map<number, number>;
  tomorrow: { date: string; due: number; reviewedToday: number };
};

/** Everything the dashboard shows, computed with src/core. */
export function todayView(data: TodayData): TodayView {
  const reviewed = new Set(data.reviewsToday.map((r) => r.itemId));
  const tomorrowItems = data.tomorrow.itemIds.map((id) => ({
    id,
    sectionId: 0,
    dueOn: data.tomorrow.date,
  }));
  const tomorrow = futureDayCounts(tomorrowItems, reviewed, data.tomorrow.date, data.date);
  return {
    counts: todayCounts(data.items, data.reviewsToday, data.date),
    list: todayList(data.items, data.sections, reviewed, data.date),
    lines: lineCounts(data.items, reviewed, data.date),
    tomorrow: {
      date: data.tomorrow.date,
      due: tomorrow.due,
      reviewedToday: tomorrow.reviewedToday,
    },
  };
}
