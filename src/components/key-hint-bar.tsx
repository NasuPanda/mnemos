import { Kbd, KbdGroup } from "@/components/ui/kbd";

/**
 * The desktop footer of key hints, beside the sidebar. Touch screens have no keys, so it never
 * shows there.
 */
export function KeyHintBar({ hints }: { hints: [keys: string[], label: string][] }) {
  return (
    <footer className="fixed right-0 bottom-0 left-[248px] z-10 hidden h-11 items-center gap-4 overflow-hidden border-t border-border bg-background px-10 text-small whitespace-nowrap text-muted-foreground lg:flex xl:gap-6 [@media(hover:none)_and_(pointer:coarse)]:hidden">
      {hints.map(([keys, label]) => (
        <span key={label} className="inline-flex items-center gap-2">
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
