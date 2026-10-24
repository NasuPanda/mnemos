/**
 * The key hints and the list of shortcuts the `?` overlay shows. Macs, iPhones and iPads show ⌘
 * where other computers show Ctrl; the shortcuts themselves accept either.
 */
export function modKey(platform: string = currentPlatform()): "⌘" | "Ctrl" {
  return /mac|iphone|ipad|ipod/i.test(platform) ? "⌘" : "Ctrl";
}

function currentPlatform(): string {
  if (typeof navigator === "undefined") return "";
  // An iPad with a keyboard reports itself as a Mac ("MacIntel"), which is what we want here.
  const data = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData;
  return data?.platform || navigator.platform || "";
}

/** One shortcut: its keys as the hints show them ("Ctrl" stands for Ctrl or ⌘), and what it does. */
export type Shortcut = { keys: string[]; action: string };
export type ShortcutGroup = { where: string; shortcuts: Shortcut[] };

/** Every shortcut, grouped by where it works, as in the plan's Keyboard shortcuts table. */
export const SHORTCUTS: ShortcutGroup[] = [
  {
    where: "Dashboard",
    shortcuts: [
      { keys: ["F"], action: "Start review, or Review early" },
      { keys: ["Shift", "F"], action: "Review the selected line" },
      { keys: ["J", "K"], action: "Move between items" },
      { keys: ["Enter"], action: "Open the selected item" },
      { keys: ["[", "]"], action: "Previous or next day" },
      { keys: ["E"], action: "Edit the item" },
      { keys: ["H"], action: "Item history" },
      { keys: ["/"], action: "Search items" },
    ],
  },
  {
    where: "Review",
    shortcuts: [
      { keys: ["Space"], action: "Show or hide the answer" },
      { keys: ["1", "2", "3"], action: "Confident, Neutral, Not at all" },
      { keys: ["D"], action: "Pick the next date yourself" },
      { keys: ["Z"], action: "Zoom the first image" },
      { keys: ["E"], action: "Edit the item" },
      { keys: ["H"], action: "Item history" },
      { keys: ["U"], action: "Undo the last rating" },
    ],
  },
  {
    where: "Items",
    shortcuts: [
      { keys: ["J", "K"], action: "Move between items" },
      { keys: ["/"], action: "Search" },
      { keys: ["Enter"], action: "Edit the selected item" },
      { keys: ["H"], action: "Item history" },
    ],
  },
  {
    where: "Item editor",
    shortcuts: [
      { keys: ["Ctrl", "Enter"], action: "Save" },
      { keys: ["H"], action: "Item history" },
    ],
  },
  {
    where: "Settings",
    shortcuts: [
      { keys: ["←", "→"], action: "Move between stops" },
      { keys: ["Enter"], action: "Edit the gap" },
      { keys: ["Del"], action: "Remove the stop" },
      { keys: ["A"], action: "Add a stop" },
    ],
  },
  {
    where: "Everywhere",
    shortcuts: [
      { keys: ["T"], action: "Review, on today" },
      { keys: ["I"], action: "Items" },
      { keys: [","], action: "Settings" },
      { keys: ["N"], action: "New item" },
      { keys: ["Ctrl", "K"], action: "Command menu" },
      { keys: ["?"], action: "All shortcuts" },
      { keys: ["Esc"], action: "Close or cancel" },
    ],
  },
];
