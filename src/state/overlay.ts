import { useSyncExternalStore } from "react";
import { useHistoryTarget } from "@/state/history-panel";

/** The panels a key opens from anywhere: the command menu (Ctrl/⌘+K) and the shortcuts (?). */
export type Overlay = "commands" | "shortcuts";

let open: Overlay | null = null;
const listeners = new Set<() => void>();

function set(next: Overlay | null) {
  open = next;
  listeners.forEach((listener) => listener());
}

export const openOverlay = (overlay: Overlay) => set(overlay);
export const closeOverlay = () => set(null);

export function useOverlay(): Overlay | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => open,
    () => null,
  );
}

/**
 * Whether a panel sits over the screen: an item's history, the command menu or the shortcuts.
 * Screens pause their own keys meanwhile.
 */
export function usePanelOpen(): boolean {
  const history = useHistoryTarget();
  const overlay = useOverlay();
  return history !== null || overlay !== null;
}
