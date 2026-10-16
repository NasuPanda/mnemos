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
