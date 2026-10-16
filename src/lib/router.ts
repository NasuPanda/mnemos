import { useEffect, useEffectEvent, useMemo, useSyncExternalStore } from "react";

// A small router on the History API: the app has a handful of screens, and Back works on phones.

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

if (typeof window !== "undefined") window.addEventListener("popstate", notify);

/** Goes to `to` (a path with an optional ?query), adding a history entry unless `replace`. */
export function navigate(to: string, options: { replace?: boolean } = {}): void {
  if (to === currentUrl()) return;
  if (options.replace) window.history.replaceState(null, "", to);
  else window.history.pushState(null, "", to);
  notify();
}

/** The current path and query, re-rendering when they change. */
export function useLocation(): { path: string; query: URLSearchParams } {
  const url = useSyncExternalStore(subscribe, currentUrl, () => "/");
  return useMemo(() => {
    const parsed = new URL(url, "http://mnemos.local");
    return { path: parsed.pathname, query: parsed.searchParams };
  }, [url]);
}

/**
 * While `open`, Back closes the overlay instead of leaving the screen: opening adds a history
 * entry on the same URL, Back calls `close`, and closing any other way takes the entry off again.
 */
export function useBackCloses(open: boolean, close: () => void): void {
  const onBack = useEffectEvent(close);

  useEffect(() => {
    if (!open) return;
    window.history.pushState({ overlay: true }, "");
    const listener = () => onBack();
    window.addEventListener("popstate", listener);
    return () => {
      window.removeEventListener("popstate", listener);
      if (window.history.state?.overlay) window.history.back();
    };
  }, [open]);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function currentUrl(): string {
  return `${window.location.pathname}${window.location.search}`;
}
