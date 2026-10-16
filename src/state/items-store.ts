import { useEffect, useSyncExternalStore } from "react";
import type { IsoDate } from "@/core";
import { getJson } from "@/lib/api";
import type { ItemSummaryDto, ItemsResponse } from "../../worker/contract";

export type ItemsState =
  | { status: "loading"; date: IsoDate }
  | { status: "failed"; date: IsoDate }
  | { status: "ready"; date: IsoDate; items: ItemSummaryDto[] };

let state: ItemsState = { status: "loading", date: "" };
const listeners = new Set<() => void>();

function setState(next: ItemsState) {
  state = next;
  listeners.forEach((listener) => listener());
}

/** Every item, for the Items list and the line counts, loading when the date changes. */
export function useItemsState(date: IsoDate): ItemsState {
  const snapshot = useSyncExternalStore(subscribe, () => state);
  useEffect(() => {
    if (state.date !== date) void loadItems(date);
  }, [date]);
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
  try {
    const { items } = await getJson<ItemsResponse>(`/api/items?date=${date}`);
    if (state.date === date) setState({ status: "ready", date, items });
  } catch {
    if (state.date === date && state.status !== "ready") setState({ status: "failed", date });
  }
}

/** Puts a saved item into the list at once, ahead of the next refresh. */
export function putItem(item: ItemSummaryDto): void {
  if (state.status !== "ready") return;
  const others = state.items.filter((i) => i.id !== item.id);
  setState({ ...state, items: [...others, item].sort((a, b) => a.id - b.id) });
}

export function dropItems(keep: (item: ItemSummaryDto) => boolean): void {
  if (state.status !== "ready") return;
  setState({ ...state, items: state.items.filter(keep) });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
