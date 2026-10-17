import { Command as CommandPrimitive } from "cmdk";
import {
  House,
  Keyboard,
  List,
  LogOut,
  Pencil,
  Play,
  Plus,
  Search,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useEffectEvent, useMemo, useState, type ReactNode } from "react";
import { InlineMarkdown } from "@/components/markdown";
import { SectionBadge } from "@/components/section-badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { openLayer } from "@/lib/layers";
import { navigateAsking, useLocation } from "@/lib/router";
import { useToday } from "@/lib/today";
import { commands } from "@/state/commands";
import { useItemsState } from "@/state/items-store";
import { closeOverlay, openOverlay, useOverlay } from "@/state/overlay";
import { todayView } from "@/state/today-data";
import { useTodayState } from "@/state/today-store";

const PLACE_ICONS: Record<string, LucideIcon> = {
  review: House,
  flash: Play,
  items: List,
  settings: SlidersHorizontal,
  "new-item": Plus,
};

/**
 * Ctrl/⌘+K from anywhere, even a text field: go to a place, review a line, find an item by name
 * to edit it, see the shortcuts or sign out. In the editor with unsaved changes, going anywhere
 * asks "Discard your changes?" first. Ctrl/⌘+K again or Esc closes it.
 */
export function CommandMenu() {
  const overlay = useOverlay();
  const open = overlay === "commands";
  const { path } = useLocation();

  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (event.isComposing || event.altKey || event.shiftKey) return;
    if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "k") return;
    event.preventDefault();
    if (open) closeOverlay();
    else if (overlay === null && !openLayer()) openOverlay("commands");
  });
  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKey(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);
  // Leaving the screen (Back) leaves the menu too.
  useEffect(() => closeOverlay(), [path]);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && closeOverlay()}>
      <DialogContent
        showCloseButton={false}
        className="top-[12dvh] max-w-[560px]! translate-y-0 gap-0 overflow-hidden rounded-lg p-0 shadow-overlay"
      >
        <DialogTitle className="sr-only">Command menu</DialogTitle>
        <DialogDescription className="sr-only">
          Go to a place, review a line, or find an item by name.
        </DialogDescription>
        {open && <MenuBody />}
      </DialogContent>
    </Dialog>
  );
}

function MenuBody() {
  const today = useToday();
  const todayState = useTodayState(today);
  const list = useItemsState(today);
  const [query, setQuery] = useState("");
  const data = todayState.status === "ready" ? todayState.data : null;
  const lines = useMemo(() => (data ? todayView(data).lines : new Map<number, number>()), [data]);
  const found = commands({
    query,
    sections: data?.sections ?? [],
    lines,
    items: list.status === "ready" ? list.items : null,
  });

  const go = (to: string) => {
    closeOverlay();
    navigateAsking(to);
  };
  const other = (id: "shortcuts" | "sign-out") => {
    if (id === "shortcuts") openOverlay("shortcuts");
    else window.location.assign("/cdn-cgi/access/logout");
  };

  return (
    <Command shouldFilter={false} loop className="rounded-none! bg-transparent p-0">
      <div className="flex h-14 items-center gap-3 border-b border-border px-4">
        <Search aria-hidden className="size-5 shrink-0 text-muted-foreground" />
        <CommandPrimitive.Input
          autoFocus
          value={query}
          onValueChange={setQuery}
          autoComplete="off"
          placeholder="Go to, review a line, or find an item"
          aria-label="Go to, review a line, or find an item"
          className="h-full min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-subtle-foreground"
        />
        <Kbd>Esc</Kbd>
      </div>
      <CommandList className="max-h-[min(460px,60dvh)] px-2 py-2">
        <CommandEmpty className="px-3 py-6 text-body text-muted-foreground">
          Nothing matches “{query.trim()}”.
        </CommandEmpty>
        {found.places.length > 0 && (
          <CommandGroup heading="Go to">
            {found.places.map((place) => (
              <Row
                key={place.id}
                value={`place-${place.id}`}
                icon={PLACE_ICONS[place.id]}
                hint={place.hint}
                onSelect={() => go(place.to)}
              >
                {place.label}
              </Row>
            ))}
          </CommandGroup>
        )}
        {found.items.length > 0 && (
          <CommandGroup heading="Items">
            {found.items.map(({ item, section, to }) => (
              <CommandItem
                key={item.id}
                value={`item-${item.id}`}
                onSelect={() => go(to)}
                className="min-h-11 gap-3 rounded-lg px-3 text-body data-selected:bg-secondary"
              >
                {section && <SectionBadge code={section.code} line={section.line} size="sm" />}
                <span className="min-w-0 flex-1 truncate">
                  <InlineMarkdown>{item.name}</InlineMarkdown>
                </span>
                <span className="inline-flex items-center gap-1.5 text-label text-muted-foreground">
                  <Pencil aria-hidden className="size-4" />
                  Edit
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {found.lines.length > 0 && (
          <CommandGroup heading="Review a line">
            {found.lines.map(({ section, left, to }) => (
              <CommandItem
                key={section.id}
                value={`line-${section.id}`}
                onSelect={() => go(to)}
                className="min-h-11 gap-3 rounded-lg px-3 text-body data-selected:bg-secondary"
              >
                <SectionBadge code={section.code} line={section.line} size="sm" />
                <span className="min-w-0 flex-1 truncate">{section.name}</span>
                <span className="font-mono text-meta text-muted-foreground">{left} left</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {found.other.length > 0 && (
          <CommandGroup heading="Other">
            {found.other.map((command) => (
              <Row
                key={command.id}
                value={command.id}
                icon={command.id === "shortcuts" ? Keyboard : LogOut}
                hint={command.hint}
                onSelect={() => other(command.id)}
              >
                {command.label}
              </Row>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </Command>
  );
}

function Row({
  value,
  icon: Icon,
  hint,
  onSelect,
  children,
}: {
  value: string;
  icon: LucideIcon | undefined;
  hint?: string;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <CommandItem
      value={value}
      onSelect={onSelect}
      className="min-h-11 gap-3 rounded-lg px-3 text-body data-selected:bg-secondary"
    >
      {Icon && <Icon aria-hidden className="size-5 text-muted-foreground" />}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {hint && (
        // Marked as the row's shortcut, so the row leaves out its check mark.
        <span data-slot="command-shortcut">
          <Kbd>{hint}</Kbd>
        </span>
      )}
    </CommandItem>
  );
}
