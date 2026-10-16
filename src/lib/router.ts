import { useEffect, useEffectEvent, useMemo, useSyncExternalStore } from "react";

// A small router on the History API: the app has a handful of screens, and Back works on phones.

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

if (typeof window !== "undefined") window.addEventListener("popstate", notify);

/**
 * Goes to `to` (a path with an optional ?query), adding a history entry unless `replace`. Each
 * entry remembers the screen it was opened from, so `leave` can go back the same way.
 */
export function navigate(to: string, options: { replace?: boolean } = {}): void {
  if (to === currentUrl()) return;
  if (options.replace) window.history.replaceState(window.history.state, "", to);
  else window.history.pushState({ from: currentUrl() }, "", to);
  notify();
}

/**
 * Leaves the current screen the way the person came: Back, if they opened it from inside the
 * app, so the screen behind is as they left it; otherwise (a reload, a shared link) `fallback`.
 */
export function leave(fallback: string): void {
  if (typeof window.history.state?.from === "string") window.history.back();
  else navigate(fallback, { replace: true });
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
