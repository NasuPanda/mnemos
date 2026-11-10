import { useSyncExternalStore } from "react";
import type { IsoDate } from "@/core";

/**
 * The browser's local calendar date as YYYY-MM-DD. This is "today" for every request: the
 * Worker runs in UTC and never works it out itself.
 */
export function localToday(now: Date = new Date()): IsoDate {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * The practice day's own today: the date the tutorial started, kept even if it runs past
 * midnight (design plan, First-run tutorial). Null outside it.
 */
let pinned: IsoDate | null = null;
const pinListeners = new Set<() => void>();

/** Pins today to `date` while the practice day is open; null lets it follow the clock again. */
export function pinToday(date: IsoDate | null): void {
  if (pinned === date) return;
  pinned = date;
  pinListeners.forEach((listener) => listener());
}

/** Today: the pinned date in the practice day, otherwise the browser's date. */
export function currentToday(now: Date = new Date()): IsoDate {
  return pinned ?? localToday(now);
}

/** Today's date, re-checked every minute and whenever the app comes back into view. */
export function useToday(): IsoDate {
  return useSyncExternalStore(subscribe, () => currentToday());
}

function subscribe(onChange: () => void): () => void {
  pinListeners.add(onChange);
  const timer = window.setInterval(onChange, 60_000);
  window.addEventListener("focus", onChange);
  document.addEventListener("visibilitychange", onChange);
  return () => {
    pinListeners.delete(onChange);
    window.clearInterval(timer);
    window.removeEventListener("focus", onChange);
    document.removeEventListener("visibilitychange", onChange);
  };
}
