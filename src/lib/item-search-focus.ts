import { navigate } from "@/lib/router";

/** "/" on the dashboard opens Items with the search box focused. */
let pending = false;

export function openItemSearch(): void {
  pending = true;
  navigate("/items");
}

/** Whether the Items screen should focus its search box as it opens; asks only once. */
export function takeSearchFocus(): boolean {
  const focus = pending;
  pending = false;
  return focus;
}
