import { useEffect, useEffectEvent } from "react";

/**
 * Keys are written as they appear in the shortcut list: "j", "Enter", "Space", "1", "Escape",
 * "[", "Shift+F", ",". Letters match either case; "Shift+" is only needed to tell F from Shift+F.
 */
export type Hotkeys = Record<string, (event: KeyboardEvent) => void>;

/**
 * Listens for the review loop's single keys while `enabled`. Keys are ignored while typing in a
 * field, with Ctrl, ⌘ or Alt held, or during IME composition.
 */
export function useHotkeys(hotkeys: Hotkeys, enabled = true): void {
  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.defaultPrevented || event.isComposing) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (isTyping(event.target)) return;
    const handler = hotkeys[keyName(event)];
    if (!handler) return;
    event.preventDefault();
    handler(event);
  });

  useEffect(() => {
    if (!enabled) return;
    const listener = (event: KeyboardEvent) => onKeyDown(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [enabled]);
}

/** The name a key is bound under: "Space", "Enter", "Shift+F", "j" … */
export function keyName(event: Pick<KeyboardEvent, "key" | "shiftKey">): string {
  if (event.key === " ") return "Space";
  if (/^[a-z]$/i.test(event.key)) {
    const letter = event.key.toLowerCase();
    return event.shiftKey ? `Shift+${letter.toUpperCase()}` : letter;
  }
  return event.key;
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}
