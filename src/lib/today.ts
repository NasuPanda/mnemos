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

/** Today's date, re-checked every minute and whenever the app comes back into view. */
export function useToday(): IsoDate {
  return useSyncExternalStore(subscribe, () => localToday());
}

function subscribe(onChange: () => void): () => void {
  const timer = window.setInterval(onChange, 60_000);
  window.addEventListener("focus", onChange);
  document.addEventListener("visibilitychange", onChange);
  return () => {
    window.clearInterval(timer);
    window.removeEventListener("focus", onChange);
    document.removeEventListener("visibilitychange", onChange);
  };
}
