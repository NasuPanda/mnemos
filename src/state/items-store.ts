import { useEffect, useSyncExternalStore } from "react";
import type { IsoDate } from "@/core";
import { api } from "@/lib/api";
import type { ItemSummaryDto } from "../../worker/contract";

export type ItemsState =
  | { status: "loading"; date: IsoDate }
  | { status: "failed"; date: IsoDate }
  | { status: "ready"; date: IsoDate; items: ItemSummaryDto[] };

let state: ItemsState = { status: "loading", date: "" };
const listeners = new Set<() => void>();
/** Goes up when the API is switched, so answers from the one before are dropped. */
let generation = 0;

function setState(next: ItemsState) {
  state = next;
  listeners.forEach((listener) => listener());
}

/** Every item, for the Items list and the line counts, loading when the date changes. */
export function useItemsState(date: IsoDate): ItemsState {
  const snapshot = useSyncExternalStore(subscribe, () => state);
  // After a reset the date is empty again, so a screen that stays open loads anew.
  useEffect(() => {
    if (state.date !== date) void loadItems(date);
  }, [date, snapshot.date]);
  return snapshot;
}

export async function loadItems(date: IsoDate): Promise<void> {
  setState({ status: "loading", date });
  await fetchItems(date);
}

/**
 * Fetches the list again without going back to loading, so the screen stays as it is until the
 * new list arrives. Does nothing if the list was never loaded.
 */
export async function refreshItems(): Promise<void> {
  if (state.status === "ready") await fetchItems(state.date);
}

async function fetchItems(date: IsoDate) {
  const asked = generation;
  try {
    const { items } = await api().items(date);
    if (asked === generation && state.date === date) setState({ status: "ready", date, items });
  } catch {
    if (asked === generation && state.date === date && state.status !== "ready") {
      setState({ status: "failed", date });
    }
  }
}

/** Forgets the list after the API was switched (see switchApi). */
export function resetItemsStore(): void {
  generation++;
  setState({ status: "loading", date: "" });
}

/**
 * Puts a saved item into the list at once, ahead of the next refresh. Saving never changes
 * whether it was reviewed today, so an item already listed keeps that.
 */
export function putItem(item: Omit<ItemSummaryDto, "reviewedToday">): void {
  if (state.status !== "ready") return;
  const previous = state.items.find((i) => i.id === item.id);
  const others = state.items.filter((i) => i.id !== item.id);
  const saved = { ...item, reviewedToday: previous?.reviewedToday ?? false };
  setState({ ...state, items: [...others, saved].sort((a, b) => a.id - b.id) });
}

export function dropItems(keep: (item: ItemSummaryDto) => boolean): void {
  if (state.status !== "ready") return;
  setState({ ...state, items: state.items.filter(keep) });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
