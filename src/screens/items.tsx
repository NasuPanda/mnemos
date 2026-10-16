import { ChevronDown, Plus, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { itemStatus, type IsoDate, type ItemSort } from "@/core";
import { AppShell } from "@/components/app-shell";
import { ItemStatusLabel } from "@/components/item-status";
import { KeyHintBar } from "@/components/key-hint-bar";
import { LineMarker } from "@/components/line-marker";
import { Link } from "@/components/link";
import { InlineMarkdown } from "@/components/markdown";
import { SectionBadge } from "@/components/section-badge";
import { StopIndicator } from "@/components/stop-indicator";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { DESKTOP, useMediaQuery } from "@/hooks/use-media-query";
import { count, shortDate } from "@/lib/format";
import { takeSearchFocus } from "@/lib/item-search-focus";
import { navigate, useLocation } from "@/lib/router";
import { editItemPath, newItemPath } from "@/lib/routes";
import { useToday } from "@/lib/today";
import { cn } from "@/lib/utils";
import { loadItems, useItemsState } from "@/state/items-store";
import {
  itemsPath,
  itemsView,
  parseItemsQuery,
  type ItemsQuery,
  type ItemsView,
} from "@/state/items-view";
import { todayView } from "@/state/today-data";
import { useTodayState } from "@/state/today-store";
import type { ItemSummaryDto, SectionDto } from "../../worker/contract";

const SORT_LABELS: Record<ItemSort, string> = {
  "next-due": "next due",
  "recently-added": "recently added",
};
/** The phone's narrower sort button. */
const SHORT_SORT_LABELS: Record<ItemSort, string> = {
  "next-due": "Next due",
  "recently-added": "Newest",
};

/** The selected row survives a trip into the editor and back. */
let rememberedSelection: number | null = null;

/** Items: find and manage items. A table on desktop, two-line rows on the phone. */
export function ItemsScreen() {
  const date = useToday();
  const today = useTodayState(date);
  const list = useItemsState(date);
  const { query: params } = useLocation();
  const query = useMemo(() => parseItemsQuery(params), [params]);
  const data = today.status === "ready" ? today.data : null;
  const lines = useMemo(() => (data ? todayView(data).lines : new Map<number, number>()), [data]);

  return (
    <AppShell sections={data?.sections ?? []} lines={lines}>
      {list.status === "failed" ? (
        <LoadFailed date={date} />
      ) : (
        <ItemsList
          date={date}
          sections={data?.sections ?? []}
          stops={data?.ladder.length ?? 0}
          items={list.status === "ready" && data ? list.items : null}
          query={query}
        />
      )}
    </AppShell>
  );
}

function ItemsList({
  date,
  sections,
  stops,
  items,
  query,
}: {
  date: IsoDate;
  sections: SectionDto[];
  stops: number;
  /** Null until both the list and the sections have loaded. */
  items: ItemSummaryDto[] | null;
  query: ItemsQuery;
}) {
  const desktop = useMediaQuery(DESKTOP);
  const searchRef = useRef<HTMLInputElement>(null);
  const view = useMemo(
    () => itemsView(items ?? [], sections, query, date),
    [items, sections, query, date],
  );
  const sectionsById = useMemo(() => new Map(sections.map((s) => [s.id, s])), [sections]);
  const filtered = query.sectionId === null ? null : (sectionsById.get(query.sectionId) ?? null);
  const newItem = newItemPath(filtered?.id);

  const [selectedId, setSelectedId] = useState(rememberedSelection);
  const ids = view.rows.map((item) => item.id);
  const selected = selectedId !== null && ids.includes(selectedId) ? selectedId : null;

  useEffect(() => {
    if (takeSearchFocus()) searchRef.current?.focus();
  }, []);

  const setQuery = (change: Partial<ItemsQuery>) =>
    navigate(itemsPath({ ...query, ...change }), { replace: true });

  const select = (id: number | undefined) => {
    if (id === undefined) return;
    rememberedSelection = id;
    setSelectedId(id);
    document.querySelector(`[data-item-id="${id}"]`)?.scrollIntoView({ block: "nearest" });
  };
  const move = (step: 1 | -1) => {
    if (selected === null) return select(step === 1 ? ids[0] : ids.at(-1));
    const index = Math.min(Math.max(ids.indexOf(selected) + step, 0), ids.length - 1);
    select(ids[index]);
  };

  useHotkeys({
    "/": () => searchRef.current?.focus(),
    j: () => move(1),
    k: () => move(-1),
    Enter: () => selected !== null && navigate(editItemPath(selected)),
    n: () => navigate(newItem),
  });

  /** In the search box: Enter goes to the first result, Esc clears, then leaves the box. */
  const onSearchKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Enter") {
      event.preventDefault();
      event.currentTarget.blur();
      select(ids[0]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      if (query.search) setQuery({ search: "" });
      else event.currentTarget.blur();
    }
  };

  return (
    <main className="mx-auto max-w-[1200px] px-4 pt-8 pb-40 sm:px-6 lg:px-10 lg:pt-10 lg:pb-24">
      <header className="flex items-center justify-between gap-6">
        <div className="flex flex-1 items-baseline justify-between gap-4 lg:flex-none lg:justify-start">
          <h1 className="text-title">Items</h1>
          {items && (
            <p className="font-mono text-meta text-muted-foreground">
              {count(items.length, "item")}
              <span className="hidden lg:inline"> · {count(sections.length, "line")}</span>
            </p>
          )}
        </div>
        <Button
          asChild
          className="hidden h-12 gap-2.5 rounded-full px-6 text-item font-bold lg:inline-flex"
        >
          <Link to={newItem}>
            <Plus aria-hidden className="size-5" />
            New item
            <Kbd className="ml-1">N</Kbd>
          </Link>
        </Button>
      </header>

      <div className="mt-5 flex items-center gap-4">
        <InputGroup className="rounded-full lg:max-w-[440px] lg:rounded-md">
          <InputGroupAddon>
            <Search aria-hidden className="size-5" />
          </InputGroupAddon>
          <InputGroupInput
            ref={searchRef}
            type="search"
            enterKeyHint="search"
            aria-label="Search items"
            placeholder={desktop ? "Search names, descriptions and notes" : "Search items"}
            value={query.search}
            onChange={(event) => setQuery({ search: event.target.value })}
            onKeyDown={onSearchKey}
            className="[&::-webkit-search-cancel-button]:appearance-none"
          />
          <InputGroupAddon align="inline-end">
            {query.search ? (
              <InputGroupButton
                size="icon-sm"
                aria-label="Clear search"
                className="size-10 rounded-full"
                onClick={() => {
                  setQuery({ search: "" });
                  searchRef.current?.focus();
                }}
              >
                <X aria-hidden className="size-5" />
              </InputGroupButton>
            ) : (
              <Kbd>/</Kbd>
            )}
          </InputGroupAddon>
        </InputGroup>
        <SortMenu
          sort={query.sort}
          onSort={(sort) => setQuery({ sort })}
          className="ml-auto hidden lg:inline-flex"
        />
      </div>

      {items && (
        <>
          <LineFilter view={view} query={query} onSelect={(id) => setQuery({ sectionId: id })} />
          <div className="mt-4 flex items-center justify-between gap-4">
            <Summary view={view} query={query} section={filtered} />
            <SortMenu
              sort={query.sort}
              onSort={(sort) => setQuery({ sort })}
              className="lg:hidden"
            />
          </div>

          {view.rows.length === 0 ? (
            <NothingHere items={items} query={query} section={filtered} newItem={newItem} />
          ) : desktop ? (
            <ItemsTable
              rows={view.rows}
              sections={sectionsById}
              stops={stops}
              date={date}
              selectedId={selected}
            />
          ) : (
            <ItemRows rows={view.rows} sections={sectionsById} stops={stops} date={date} />
          )}
        </>
      )}

      <Button
        asChild
        className="fixed inset-x-4 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-20 h-14 gap-2.5 rounded-full text-item font-bold shadow-cta sm:inset-x-auto sm:left-1/2 sm:w-[min(760px,calc(100%-3rem))] sm:-translate-x-1/2 lg:hidden"
      >
        <Link to={newItem}>
          <Plus aria-hidden className="size-5" />
          New item
        </Link>
      </Button>
      <KeyHintBar
        hints={[
          [["/"], "search"],
          [["J", "K"], "move"],
          [["Enter"], "edit"],
          [["N"], "new item"],
        ]}
      />
    </main>
  );
}

function SortMenu({
  sort,
  onSort,
  className,
}: {
  sort: ItemSort;
  onSort: (sort: ItemSort) => void;
  className?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            "h-12 shrink-0 gap-3 rounded-full pr-1.5 pl-3 text-small font-normal text-muted-foreground",
            className,
          )}
        >
          <span className="hidden lg:inline">Sorted by {SORT_LABELS[sort]}</span>
          <span className="lg:hidden" aria-hidden>
            {SHORT_SORT_LABELS[sort]}
          </span>
          <span className="sr-only lg:hidden">Sorted by {SORT_LABELS[sort]}</span>
          <span className="grid size-10 place-items-center rounded-full bg-secondary text-foreground">
            <ChevronDown aria-hidden className="size-5" />
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52 rounded-lg p-1.5 shadow-raised">
        <DropdownMenuRadioGroup value={sort} onValueChange={(value) => onSort(value as ItemSort)}>
          {(Object.keys(SORT_LABELS) as ItemSort[]).map((value) => (
            <DropdownMenuRadioItem key={value} value={value} className="h-11 text-body">
              Sort by {SORT_LABELS[value]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** "All lines", then a chip per line with its count. Scrolls sideways on the phone. */
function LineFilter({
  view,
  query,
  onSelect,
}: {
  view: ItemsView;
  query: ItemsQuery;
  onSelect: (sectionId: number | null) => void;
}) {
  return (
    <ToggleGroup
      type="single"
      aria-label="Line"
      value={query.sectionId === null ? "all" : String(query.sectionId)}
      onValueChange={(value) => value && onSelect(value === "all" ? null : Number(value))}
      spacing={1.5}
      className="no-scrollbar -mx-4 mt-4 w-auto max-w-none overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0"
    >
      {view.chips.map(({ section, count: n }) => (
        <ToggleGroupItem
          key={section?.id ?? "all"}
          value={section ? String(section.id) : "all"}
          aria-label={section ? `${section.name}, ${n}` : `All lines, ${n}`}
          className="relative h-12 gap-1.5 rounded-lg border border-border bg-card px-2 text-item-sm lg:h-11 font-semibold after:absolute after:bottom-1.5 after:left-1/2 after:h-[3px] after:w-6 after:-translate-x-1/2 after:rounded-full hover:bg-accent data-[state=on]:border-input data-[state=on]:bg-secondary data-[state=on]:after:bg-primary"
        >
          {section ? (
            <SectionBadge code={section.code} line={section.line} size="sm" />
          ) : (
            <span>
              All<span className="hidden lg:inline"> lines</span>
            </span>
          )}
          <span className="font-mono text-meta text-muted-foreground">{n}</span>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

/** "23 items on GR Graphs · 3 late · 5 more due today · 1 reviewed today". */
function Summary({
  view,
  query,
  section,
}: {
  view: ItemsView;
  query: ItemsQuery;
  section: SectionDto | null;
}) {
  const { items, late, dueToday, reviewedToday } = view.counts;
  return (
    <p className="text-small text-muted-foreground">
      <strong className="font-bold text-foreground">{count(items, "item")}</strong>
      {section && (
        <>
          {" on "}
          <SectionBadge code={section.code} line={section.line} size="sm" className="mx-0.5" />{" "}
          {section.name}
        </>
      )}
      {query.search.trim() && <> match “{query.search.trim()}”</>}
      {late > 0 && ` · ${late} late`}
      {dueToday > 0 && ` · ${dueToday} ${late > 0 ? "more " : ""}due today`}
      {reviewedToday > 0 && ` · ${reviewedToday} reviewed today`}
    </p>
  );
}

function ItemsTable({
  rows,
  sections,
  stops,
  date,
  selectedId,
}: {
  rows: ItemSummaryDto[];
  sections: Map<number, SectionDto>;
  stops: number;
  date: IsoDate;
  selectedId: number | null;
}) {
  return (
    <table className="mt-3 w-full border-collapse text-left">
      <thead>
        <tr className="text-label text-muted-foreground">
          <th className="w-14 py-2">
            <span className="sr-only">Selected</span>
          </th>
          <th className="w-20 py-2 font-semibold">Line</th>
          <th className="py-2 font-semibold">Item</th>
          <th className="w-36 py-2 font-semibold">Stop</th>
          <th className="w-36 py-2 font-semibold">Next due</th>
          <th className="w-48 py-2 font-semibold">Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((item) => {
          const section = sections.get(item.sectionId);
          if (!section) return null;
          const selected = item.id === selectedId;
          return (
            <tr
              key={item.id}
              data-item-id={item.id}
              onClick={(event) => {
                if (!(event.target as HTMLElement).closest("a")) navigate(editItemPath(item.id));
              }}
              className={cn(
                "h-12 cursor-pointer border-b border-border hover:bg-accent/60 [&>td:first-child]:rounded-l-lg [&>td:last-child]:rounded-r-lg",
                selected && "bg-secondary hover:bg-secondary",
              )}
            >
              <td className="pl-5">
                <LineMarker line={section.line} selected={selected} className="block" />
              </td>
              <td>
                <SectionBadge code={section.code} line={section.line} />
              </td>
              <td className="py-2 pr-4">
                <Link
                  to={editItemPath(item.id)}
                  aria-current={selected ? "true" : undefined}
                  className="rounded-sm text-item-sm font-semibold"
                >
                  <InlineMarkdown>{item.name}</InlineMarkdown>
                </Link>
              </td>
              <td>
                <StopIndicator stop={item.stop} stops={stops} />
              </td>
              <td className="font-mono text-meta">{shortDate(item.dueOn)}</td>
              <td>
                <ItemStatusLabel status={itemStatus(item, date)} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** On the phone: the name, then the badge, stop, and the status or the next due date. */
function ItemRows({
  rows,
  sections,
  stops,
  date,
}: {
  rows: ItemSummaryDto[];
  sections: Map<number, SectionDto>;
  stops: number;
  date: IsoDate;
}) {
  return (
    <ul className="-mx-4 mt-2 sm:mx-0">
      {rows.map((item) => {
        const section = sections.get(item.sectionId);
        if (!section) return null;
        const status = itemStatus(item, date);
        return (
          <li key={item.id}>
            <Link
              to={editItemPath(item.id)}
              data-item-id={item.id}
              className="flex gap-3 border-b border-border px-4 py-3 active:bg-accent"
            >
              <LineMarker line={section.line} className="mt-1" />
              <span className="flex min-w-0 flex-col gap-1.5">
                <span className="text-item font-semibold">
                  <InlineMarkdown>{item.name}</InlineMarkdown>
                </span>
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
                  <SectionBadge code={section.code} line={section.line} size="sm" />
                  <StopIndicator stop={item.stop} stops={stops} />
                  {status.kind === "scheduled" ? (
                    <span className="font-mono text-meta">{shortDate(item.dueOn)}</span>
                  ) : (
                    <ItemStatusLabel status={status} />
                  )}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Quiet empty states: no items yet, none in this line, or nothing matching the search. */
function NothingHere({
  items,
  query,
  section,
  newItem,
}: {
  items: ItemSummaryDto[];
  query: ItemsQuery;
  section: SectionDto | null;
  newItem: string;
}) {
  const searching = query.search.trim() !== "";
  const [title, description] = searching
    ? [`Nothing matches “${query.search.trim()}”`, "Try fewer words, or another line."]
    : section
      ? [
          `No items on ${section.code} · ${section.name} yet`,
          "Add one, or paste a screenshot of a problem.",
        ]
      : items.length === 0
        ? ["No items yet", "Add your first one: a problem, its answer, and a photo if it helps."]
        : ["Nothing here", ""];
  return (
    <Empty className="mt-8">
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        {description && <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>
      {!searching && (
        <Button asChild variant="secondary" className="h-12 gap-2 px-5 text-item font-bold">
          <Link to={newItem}>
            <Plus aria-hidden className="size-5" />
            New item
            <Kbd className="ml-1">N</Kbd>
          </Link>
        </Button>
      )}
    </Empty>
  );
}

function LoadFailed({ date }: { date: IsoDate }) {
  return (
    <main className="mx-auto max-w-[1200px] px-4 pt-8 sm:px-6 lg:px-10 lg:pt-10">
      <h1 className="text-title">Items</h1>
      <Empty className="mt-8">
        <EmptyHeader>
          <EmptyTitle>Items didn’t load</EmptyTitle>
          <EmptyDescription>Check your connection, then try again.</EmptyDescription>
        </EmptyHeader>
        <Button variant="secondary" className="h-12 px-5" onClick={() => void loadItems(date)}>
          Try again
        </Button>
      </Empty>
    </main>
  );
}
