import {
  compareDates,
  futureDayCounts,
  lineCounts,
  todayCounts,
  todayList,
  type DayEntry,
} from "@/core";
import type { ItemDto, ReviewDto, TodayResponse } from "../../worker/contract";

/**
 * The client's copy of today. Ratings and Undo change it at once, before the Worker confirms,
 * using these pure functions; the counts and order come from src/core.
 */
export type TodayData = TodayResponse;

/**
 * A rating applied: the item leaves today's list (if it was on it) and the review counts as Done.
 * Early reviews count too. Tomorrow's count follows the item: it joins when rated onto tomorrow,
 * and leaves when an item due tomorrow is reviewed early onto a later day.
 */
export function applyRating(data: TodayData, item: ItemDto, review: ReviewDto): TodayData {
  return {
    ...data,
    items: data.items.filter((i) => i.id !== item.id),
    reviewsToday: [...data.reviewsToday, review],
    tomorrow: withTomorrow(data.tomorrow, item.id, review.nextDueOn),
  };
}

/**
 * The inverse of applyRating, for Undo or when the Worker refuses a rating: `item` as it was
 * before. It goes back on today's list only if it was due today or earlier.
 */
export function revertRating(data: TodayData, item: ItemDto, reviewId: number): TodayData {
  const others = data.items.filter((i) => i.id !== item.id);
  const wasLeft = compareDates(item.dueOn, data.date) <= 0;
  return {
    ...data,
    items: wasLeft ? [...others, item].sort((a, b) => a.id - b.id) : others,
    reviewsToday: data.reviewsToday.filter((r) => r.id !== reviewId),
    tomorrow: withTomorrow(data.tomorrow, item.id, item.dueOn),
  };
}

/** Tomorrow's due items with `itemId` now due on `dueOn`. */
function withTomorrow(
  tomorrow: TodayData["tomorrow"],
  itemId: number,
  dueOn: string,
): TodayData["tomorrow"] {
  const others = tomorrow.itemIds.filter((id) => id !== itemId);
  const itemIds = dueOn === tomorrow.date ? [...others, itemId].sort((a, b) => a - b) : others;
  return itemIds.length === tomorrow.itemIds.length &&
    itemIds.every((id, i) => id === tomorrow.itemIds[i])
    ? tomorrow
    : { ...tomorrow, itemIds };
}

/** Swaps the temporary id of an optimistic review for the one the Worker stored. */
export function confirmReview(data: TodayData, tempId: number, review: ReviewDto): TodayData {
  return { ...data, reviewsToday: data.reviewsToday.map((r) => (r.id === tempId ? review : r)) };
}

/**
 * A saved item: on today's list if it is due today or earlier and not reviewed today, with its
 * new content; otherwise off it. A new item is due the day it's added, so it appears at once.
 */
export function withSavedItem(data: TodayData, item: ItemDto): TodayData {
  const others = data.items.filter((i) => i.id !== item.id);
  const reviewed = data.reviewsToday.some((review) => review.itemId === item.id);
  const left = compareDates(item.dueOn, data.date) <= 0 && !reviewed;
  return { ...data, items: left ? [...others, item].sort((a, b) => a.id - b.id) : others };
}

/** A deleted item: gone from today's list and from tomorrow's count. */
export function withoutItem(data: TodayData, itemId: number): TodayData {
  return {
    ...data,
    items: data.items.filter((i) => i.id !== itemId),
    tomorrow: { ...data.tomorrow, itemIds: data.tomorrow.itemIds.filter((id) => id !== itemId) },
  };
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
