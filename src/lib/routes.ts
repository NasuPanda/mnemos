import { isIsoDate, type IsoDate } from "@/core";

/** The app's screens, from the URL path. */
export type Route =
  | { screen: "today" }
  | { screen: "flash" }
  | { screen: "review" }
  | { screen: "items" }
  | { screen: "new-item" }
  | { screen: "edit-item"; itemId: number }
  | { screen: "settings" }
  | { screen: "unknown" };

const FIXED: Record<string, Route> = {
  "/": { screen: "today" },
  "/flash": { screen: "flash" },
  "/review": { screen: "review" },
  "/items": { screen: "items" },
  "/items/new": { screen: "new-item" },
  "/settings": { screen: "settings" },
};

export function matchRoute(path: string): Route {
  const fixed = FIXED[path];
  if (fixed) return fixed;
  const edit = /^\/items\/([1-9]\d{0,15})$/.exec(path);
  if (edit) return { screen: "edit-item", itemId: Number(edit[1]) };
  return { screen: "unknown" };
}

/** The editor for an item. */
export const editItemPath = (itemId: number) => `/items/${itemId}`;

/** A new item, in `sectionId`'s line when one is given. */
export const newItemPath = (sectionId?: number) =>
  sectionId === undefined ? "/items/new" : `/items/new?section=${sectionId}`;

/**
 * The dashboard for `day`: /?day=YYYY-MM-DD, or plain "/" for today, so the Today tab and T always
 * mean today.
 */
export const dayPath = (day: IsoDate, today: IsoDate) => (day === today ? "/" : `/?day=${day}`);

/** The day the dashboard shows: ?day=YYYY-MM-DD, or today when it is missing or not a date. */
export function dayFromQuery(query: URLSearchParams, today: IsoDate): IsoDate {
  const day = query.get("day");
  return isIsoDate(day) ? day : today;
}

/**
 * What a review run goes through: everything left today, or a future day's items to review
 * early (`day`); optionally one line or one item.
 */
export type RunTarget = { day?: IsoDate | null; sectionId?: number; itemId?: number };

/** The flash review start for a run: /flash, /flash?section=3, /flash?day=2026-09-25 … */
export const flashPath = (target: RunTarget = {}) => withQuery("/flash", target);

/** Review mode for a run: /review, /review?item=5, /review?day=2026-09-25&section=3 … */
export const reviewPath = (target: RunTarget = {}) => withQuery("/review", target);

/** The run a /flash or /review address asks for. */
export function runTargetFromQuery(query: URLSearchParams): RunTarget {
  const day = query.get("day");
  const sectionId = positive(query.get("section"));
  const itemId = positive(query.get("item"));
  return {
    ...(isIsoDate(day) ? { day } : {}),
    ...(itemId ? { itemId } : sectionId ? { sectionId } : {}),
  };
}

function withQuery(path: string, { day, sectionId, itemId }: RunTarget): string {
  const query = new URLSearchParams();
  if (day) query.set("day", day);
  if (itemId !== undefined) query.set("item", String(itemId));
  else if (sectionId !== undefined) query.set("section", String(sectionId));
  const search = query.toString();
  return search ? `${path}?${search}` : path;
}

function positive(value: string | null): number | undefined {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : undefined;
}
