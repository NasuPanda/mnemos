import { useSyncExternalStore } from "react";

/** Whether a CSS media query matches, updating when it changes. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** The sidebar layout starts at 1024 px; below that, the phone layout with the tab bar. */
export const DESKTOP = "(min-width: 1024px)";
