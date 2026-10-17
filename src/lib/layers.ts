/** What a popover, menu, sheet or dialog renders its content in. */
const LAYERS = [
  "popover-content",
  "dropdown-menu-content",
  "drawer-content",
  "alert-dialog-content",
  "dialog-content",
].map((slot) => `[data-slot="${slot}"]`);

const inState = (state: "open" | "closed") =>
  LAYERS.map((layer) => `${layer}[data-state="${state}"]`).join(", ");

/**
 * Whether a popover, menu, sheet or dialog is open; it has the keys until it closes. One that is
 * fading out after closing doesn't count.
 */
export function openLayer(): boolean {
  return !!document.querySelector(inState("open"));
}

/**
 * Whether `element` sits in a layer fading out after closing: it keeps the focus for its 100 ms,
 * but its fields and buttons are already gone, so keys pressed meanwhile belong to the screen.
 */
export function inClosingLayer(element: Element): boolean {
  return !!element.closest(inState("closed"));
}
