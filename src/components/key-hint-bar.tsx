import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";

/** Keys, what they do, and `wide` for a hint that waits for 1280 px because it shows elsewhere too. */
export type KeyHint = [keys: string[], label: string, options?: { wide?: boolean }];

/**
 * The desktop footer of key hints, beside the sidebar. Touch screens have no keys, so it never
 * shows there.
 */
export function KeyHintBar({ hints }: { hints: KeyHint[] }) {
  return (
    <footer className="fixed right-0 bottom-0 left-[248px] z-10 hidden h-11 items-center gap-4 overflow-hidden border-t border-border bg-background px-10 text-small whitespace-nowrap text-muted-foreground lg:flex xl:gap-6 [@media(hover:none)_and_(pointer:coarse)]:hidden">
      {hints.map(([keys, label, options]) => (
        <span
          key={label}
          className={cn(
            "items-center gap-2",
            options?.wide ? "hidden xl:inline-flex" : "inline-flex",
          )}
        >
          <KbdGroup>
            {keys.map((key) => (
              <Kbd key={key}>{key}</Kbd>
            ))}
          </KbdGroup>
          {label}
        </span>
      ))}
    </footer>
  );
}
