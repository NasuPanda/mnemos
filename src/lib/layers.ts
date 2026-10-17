/**
 * Whether a popover, menu, sheet or dialog is open; it has the keys until it closes. One that is
 * fading out after closing doesn't count.
 */
export function openLayer(): boolean {
  return !!document.querySelector(
    [
      "popover-content",
      "dropdown-menu-content",
      "drawer-content",
      "alert-dialog-content",
      "dialog-content",
    ]
      .map((slot) => `[data-slot="${slot}"][data-state="open"]`)
      .join(", "),
  );
}
