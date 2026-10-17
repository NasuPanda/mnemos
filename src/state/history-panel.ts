import { useSyncExternalStore } from "react";

/** Which item's history is open, if any. One panel serves every screen. */
export type HistoryTarget = {
  itemId: number;
  /** In review before the answer shows, the name stays hidden, as it does on screen. */
  hideName: boolean;
};

let target: HistoryTarget | null = null;
const listeners = new Set<() => void>();

function set(next: HistoryTarget | null) {
  target = next;
  listeners.forEach((listener) => listener());
}

/** H, or History: opens the panel over the current screen, which stays as it is. */
export const openHistory = (itemId: number, options: { hideName?: boolean } = {}) =>
  set({ itemId, hideName: options.hideName ?? false });

export const closeHistory = () => set(null);

/** The open panel's item; screens pause their own keys while it is open. */
export function useHistoryTarget(): HistoryTarget | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => target,
    () => null,
  );
}
