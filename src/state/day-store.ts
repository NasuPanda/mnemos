import { useEffect, useSyncExternalStore } from "react";
import { addDays, weekOf, type IsoDate } from "@/core";
import { api } from "@/lib/api";
import type { ItemDto } from "../../worker/contract";
import { withMovedItem, withoutDayItem, type DayData } from "./day-data";

export type DayState =
  { status: "loading" } | { status: "failed" } | { status: "ready"; data: DayData; stale: boolean };

const LOADING: DayState = { status: "loading" };

/** Days already fetched, by today and date: moving back and forth needs no new request. */
const cache = new Map<string, DayState>();
const listeners = new Set<() => void>();
const keyOf = (date: IsoDate, today: IsoDate) => `${today}|${date}`;
/** Goes up when the API is switched, so answers from the one before are dropped. */
let generation = 0;

function set(key: string, next: DayState) {
  cache.set(key, next);
  listeners.forEach((listener) => listener());
}

/**
 * Another day (or today's week strip), fetched once and kept. The next and previous days, and
 * the same day a week either side, are fetched ahead, so [ and ], the arrows and a swipe change
 * the day at once. A stale day stays on screen while it is
 * fetched again. No spinner: until the first answer the screen waits quietly.
 */
export function useDayState(date: IsoDate, today: IsoDate): DayState {
  const key = keyOf(date, today);
  const snapshot = useSyncExternalStore(subscribe, () => cache.get(key) ?? LOADING);
  const stale = snapshot.status === "ready" && snapshot.stale;
  const ready = snapshot.status === "ready";
  // After a reset, a screen that stays open fetches its day anew.
  const resets = useSyncExternalStore(subscribe, () => generation);

  useEffect(() => {
    forgetOtherTodays(today);
    void ensure(date, today);
  }, [date, today, stale, resets]);

  useEffect(() => {
    if (!ready) return;
    void ensure(addDays(date, 1), today);
    void ensure(addDays(date, -1), today);
    // The neighbouring weeks, for the desktop arrows and the phone's swipe.
    void ensure(addDays(date, 7), today);
    void ensure(addDays(date, -7), today);
  }, [date, today, ready]);

  return snapshot;
}

/**
 * The week strip's rows for `date`'s week, from any day of that week already fetched, so the
 * strip stays put while the day changes within the week.
 */
export function useWeek(date: IsoDate, today: IsoDate): DayData["week"] | null {
  return useSyncExternalStore(subscribe, () => {
    for (const day of weekOf(date)) {
      const state = cache.get(keyOf(day, today));
      if (state?.status === "ready") return state.data.week;
    }
    return null;
  });
}

/**
 * Whether any day has answered for this today, loaded or failed. The dashboard's first screen
 * waits for it; after that, a week not fetched yet shows its dates and fills in.
 */
export function useAnyDayAnswered(today: IsoDate): boolean {
  return useSyncExternalStore(subscribe, () => {
    for (const [key, state] of cache) {
      if (key.startsWith(`${today}|`) && state.status !== "loading") return true;
    }
    return false;
  });
}

/** Fetches a day unless it is already here and up to date. */
async function ensure(date: IsoDate, today: IsoDate): Promise<void> {
  const key = keyOf(date, today);
  const current = cache.get(key);
  if (current && !(current.status === "ready" && current.stale) && current.status !== "failed") {
    return;
  }
  if (!current || current.status === "failed") set(key, LOADING);
  else set(key, { ...current, stale: false });
  const asked = generation;
  try {
    const data = await api().day(date, today);
    if (asked === generation) set(key, { status: "ready", data, stale: false });
  } catch {
    if (asked === generation && cache.get(key)?.status !== "ready") set(key, { status: "failed" });
  }
}

/** Forgets every day fetched, after the API was switched (see switchApi). */
export function resetDayStore(): void {
  generation++;
  cache.clear();
  listeners.forEach((listener) => listener());
}

/** Try a day again after it failed to load. */
export const retryDay = (date: IsoDate, today: IsoDate) => ensure(date, today);

/** A rated or undone item, moved on every day already fetched (see withMovedItem). */
export function moveDayItem(item: ItemDto): void {
  update((data) => withMovedItem(data, item));
}

/** A deleted item, gone from every day already fetched. */
export function forgetDayItem(itemId: number): void {
  update((data) => withoutDayItem(data, itemId));
}

/**
 * After an item, a line or the ladder changed: every day fetched so far is fetched again when
 * next shown, and stays on screen until then.
 */
export function refreshDays(): void {
  for (const [key, state] of cache) {
    if (state.status === "ready") cache.set(key, { ...state, stale: true });
    else cache.delete(key);
  }
  listeners.forEach((listener) => listener());
}

function update(change: (data: DayData) => DayData) {
  for (const [key, state] of cache) {
    if (state.status === "ready") cache.set(key, { ...state, data: change(state.data) });
  }
  listeners.forEach((listener) => listener());
}

/** After midnight, yesterday's view of the week is no use. */
function forgetOtherTodays(today: IsoDate) {
  for (const key of cache.keys()) if (!key.startsWith(`${today}|`)) cache.delete(key);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
