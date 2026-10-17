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
  if (guarded && window.history.state?.guard) {
    // A Back guard's entry gives way to the new screen, so Back from there skips it.
    guarded = false;
    window.history.replaceState({ from: currentUrl() }, "", to);
  } else if (options.replace) window.history.replaceState(window.history.state, "", to);
  else window.history.pushState({ from: currentUrl() }, "", to);
  notify();
}

/** The open screen's question before it is left for another one, while it has unsaved changes. */
let leaveCheck: ((proceed: () => void) => void) | null = null;

/**
 * Goes to `to` like `navigate`, but a screen with unsaved changes asks first ("Discard your
 * changes?"), and `proceed` goes on if the person says yes. Links, the T, I, , and N keys and
 * the command menu leave this way.
 */
export function navigateAsking(to: string, options: { replace?: boolean } = {}): void {
  if (to === currentUrl()) return;
  if (leaveCheck) leaveCheck(() => navigate(to, options));
  else navigate(to, options);
}

/** While `active`, leaving through `navigateAsking` calls `ask` instead, with the way on. */
export function useLeaveCheck(active: boolean, ask: (proceed: () => void) => void): void {
  const onAsk = useEffectEvent(ask);
  useEffect(() => {
    if (!active) return;
    const check = (proceed: () => void) => onAsk(proceed);
    leaveCheck = check;
    return () => {
      if (leaveCheck === check) leaveCheck = null;
    };
  }, [active]);
}

/**
 * Leaves the current screen the way the person came: Back, if they opened it from inside the
 * app, so the screen behind is as they left it; otherwise (a reload, a shared link) `fallback`.
 */
export function leave(fallback: string): void {
  // A Back guard's own entry sits on top; leaving takes it off in the same step.
  const steps = guarded ? 2 : 1;
  guarded = false;
  if (typeof window.history.state?.from === "string") window.history.go(-steps);
  else navigate(fallback, { replace: true });
}

/** Whether a Back guard's history entry is on top right now. */
let guarded = false;

/**
 * While `active`, Back asks before leaving: an extra history entry on the same URL takes the
 * Back, and `onBack` decides (a "Discard changes?" question). If the person stays, `rearm` puts
 * a new entry in place of the one Back used. `leave` takes the entry off with the screen.
 */
export function useBackGuard(active: boolean, onBack: () => void): { rearm: () => void } {
  const handleBack = useEffectEvent(onBack);

  useEffect(() => {
    if (!active) return;
    armGuard();
    const listener = () => {
      if (!guarded || window.history.state?.guard) return;
      // Back used the guard's entry: we're on the screen's own entry again.
      guarded = false;
      handleBack();
    };
    window.addEventListener("popstate", listener);
    return () => {
      window.removeEventListener("popstate", listener);
      if (guarded && window.history.state?.guard) {
        guarded = false;
        window.history.back();
      }
    };
  }, [active]);

  return { rearm: () => active && armGuard() };
}

function armGuard() {
  if (guarded) return;
  window.history.pushState({ ...window.history.state, guard: true }, "");
  guarded = true;
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
