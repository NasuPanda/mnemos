/** What a popover, menu, sheet or dialog renders its content in. */
const APP_LAYERS = [
  "popover-content",
  "dropdown-menu-content",
  "drawer-content",
  "alert-dialog-content",
  "dialog-content",
];
/** The first-run tutorial's Explain card is modal too: the app's keys wait while it is open. */
const LAYERS = [...APP_LAYERS, "tour-card"];

const inState = (state: "open" | "closed", slots = LAYERS) =>
  slots.map((slot) => `[data-slot="${slot}"][data-state="${state}"]`).join(", ");

/**
 * Whether a popover, menu, sheet or dialog is open; it has the keys until it closes. One that is
 * fading out after closing doesn't count.
 */
export function openLayer(): boolean {
  return !!document.querySelector(inState("open"));
}

/** Whether one of the app's own popovers, menus, sheets or dialogs is open: the tour waits. */
export function openAppLayer(): boolean {
  return !!document.querySelector(inState("open", APP_LAYERS));
}

/**
 * Whether `element` sits in a layer fading out after closing: it keeps the focus for its 100 ms,
 * but its fields and buttons are already gone, so keys pressed meanwhile belong to the screen.
 */
export function inClosingLayer(element: Element): boolean {
  return !!element.closest(inState("closed"));
}
