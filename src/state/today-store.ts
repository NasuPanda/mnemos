import { useEffect, useSyncExternalStore } from "react";
import { toast } from "sonner";
import {
  rate,
  type Confidence,
  type IsoDate,
  type Line,
  type RateRefusal,
  type Result,
} from "@/core";
import { del, getJson, postJson } from "@/lib/api";
import type {
  ItemDto,
  RateResponse,
  ReviewDto,
  SectionDto,
  TodayResponse,
} from "../../worker/contract";
import { moveDayItem } from "./day-store";
import {
  applyRating,
  confirmReview,
  revertRating,
  withoutItem,
  withSavedItem,
  type TodayData,
} from "./today-data";

export type TodayState =
  | { status: "loading"; date: IsoDate }
  | { status: "failed"; date: IsoDate }
  | { status: "ready"; date: IsoDate; data: TodayData };

let state: TodayState = { status: "loading", date: "" };
const listeners = new Set<() => void>();
/** Rated items, kept so Undo can put them back with all their content. */
const ratedItems = new Map<number, ItemDto>();
/** Optimistic reviews still waiting for the Worker: temporary id → the stored review's id. */
const pending = new Map<number, Promise<number | null>>();
let nextTempId = -1;

function setState(next: TodayState) {
  state = next;
  listeners.forEach((listener) => listener());
}

function updateData(change: (data: TodayData) => TodayData) {
  if (state.status === "ready") setState({ ...state, data: change(state.data) });
}

/** Today's data for `date`, loading it when the date changes. No spinner: screens wait quietly. */
export function useTodayState(date: IsoDate): TodayState {
  const snapshot = useSyncExternalStore(subscribe, () => state);
  useEffect(() => {
    if (state.date !== date) void load(date);
  }, [date]);
  return snapshot;
}

export async function load(date: IsoDate): Promise<void> {
  setState({ status: "loading", date });
  try {
    const data = await getJson<TodayResponse>(`/api/today?date=${date}`);
    if (state.date === date) setState({ status: "ready", date, data });
  } catch {
    if (state.date === date) setState({ status: "failed", date });
  }
}

/**
 * Fetches today again in the background after an item or section changed, once ratings still
 * on their way have settled. The screen keeps showing the current data until the new arrives.
 */
export async function refreshToday(): Promise<void> {
  if (state.status !== "ready") return;
  await Promise.all(pending.values());
  const date = state.date;
  try {
    const data = await getJson<TodayResponse>(`/api/today?date=${date}`);
    if (state.date === date) setState({ status: "ready", date, data });
  } catch {
    // The next load brings it up to date; nothing on screen is wrong in the meantime.
  }
}

/** A saved item, shown on today's list at once (see withSavedItem). */
export function putTodayItem(item: ItemDto): void {
  updateData((data) => withSavedItem(data, item));
}

/** A deleted item leaves today's list and tomorrow's count at once. */
export function forgetTodayItem(itemId: number): void {
  updateData((data) => withoutItem(data, itemId));
}

/** A new section order, shown at once: the dashboard and flash review follow it. */
export function orderSections(ids: number[]): void {
  updateData((data) => ({
    ...data,
    sections: ids.flatMap((id, index) => {
      const section = data.sections.find((s) => s.id === id);
      return section ? [{ ...section, position: index + 1 }] : [];
    }),
  }));
}

/** A section created or changed in the editor or on Settings, shown at once. */
export function putSection(section: SectionDto, nextLine?: Line): void {
  updateData((data) => ({
    ...data,
    nextLine: nextLine ?? data.nextLine,
    sections: data.sections.some((s) => s.id === section.id)
      ? data.sections.map((s) => (s.id === section.id ? section : s))
      : [...data.sections, section],
  }));
}

export type LocalRating = { reviewId: number; itemId: number; review: ReviewDto };

/** An item as a rating leaves it. */
const ratedCopy = (item: ItemDto, review: ReviewDto): ItemDto => ({
  ...item,
  stop: review.stopAfter,
  dueOn: review.nextDueOn,
});

/**
 * Rates an item now and tells the Worker in the background. `item` is the run's own copy, so an
 * item due on a later day (Review early) rates the same way as one left today. The rules come
 * from src/core, so today, other days and the week strip update at once; if the Worker refuses,
 * the rating is rolled back with a message.
 */
export function rateItem(
  item: ItemDto,
  confidence: Confidence,
  pickedDate?: IsoDate,
): Result<LocalRating, RateRefusal | "not-ready"> {
  if (state.status !== "ready") return { ok: false, error: "not-ready" };
  const { data, date } = state;
  const itemId = item.id;

  const result = rate({
    item,
    ladder: data.ladder,
    today: date,
    confidence,
    pickedDate,
    reviewedToday: data.reviewsToday.some((r) => r.itemId === itemId),
  });
  if (!result.ok) return result;

  const tempId = nextTempId--;
  const review: ReviewDto = { id: tempId, itemId, ...result.value };
  ratedItems.set(itemId, item);
  updateData((d) => applyRating(d, item, review));
  moveDayItem(ratedCopy(item, review));

  const saved = postJson<RateResponse>("/api/reviews", { itemId, date, confidence, pickedDate })
    .then((response) => {
      updateData((d) => confirmReview(d, tempId, response.review));
      return response.review.id;
    })
    .catch(() => {
      updateData((d) => revertRating(d, item, tempId));
      moveDayItem(item);
      toast("That rating didn’t save. The item is back where it was.");
      return null;
    });
  pending.set(tempId, saved);
  return { ok: true, value: { reviewId: tempId, itemId, review } };
}

/** Undo a rating made in this session: the item comes back as it was, on whichever day. */
export async function undoRating(rating: LocalRating): Promise<boolean> {
  if (state.status !== "ready") return false;
  const item = ratedItems.get(rating.itemId);
  if (!item) return false;
  const reviewId = rating.reviewId < 0 ? await pending.get(rating.reviewId) : rating.reviewId;
  if (!reviewId || state.status !== "ready") return false;

  const date = state.date;
  const review = state.data.reviewsToday.find((r) => r.id === reviewId);
  if (!review) return false;
  updateData((d) => revertRating(d, item, reviewId));
  moveDayItem(item);
  try {
    await del(`/api/reviews/${reviewId}?date=${date}`);
    return true;
  } catch {
    updateData((d) => applyRating(d, item, review));
    moveDayItem(ratedCopy(item, review));
    toast("Undo didn’t go through. The rating stands.");
    return false;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
