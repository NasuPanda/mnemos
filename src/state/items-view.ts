import { ITEM_SORTS, listCounts, sortItems, type IsoDate, type ItemSort } from "@/core";
import type { ItemSummaryDto, SectionDto } from "../../worker/contract";
import { matches, searchText, searchWords } from "./item-search";

/** What the Items list shows, kept in the URL so Back from the editor returns to it. */
export type ItemsQuery = { search: string; sectionId: number | null; sort: ItemSort };

export function parseItemsQuery(params: URLSearchParams): ItemsQuery {
  const line = Number(params.get("line"));
  const sort = params.get("sort");
  return {
    search: params.get("q") ?? "",
    sectionId: Number.isSafeInteger(line) && line > 0 ? line : null,
    sort: ITEM_SORTS.includes(sort as ItemSort) ? (sort as ItemSort) : "next-due",
  };
}

/** "/items?q=heap&line=3": only what differs from the plain list. */
export function itemsPath(query: ItemsQuery): string {
  const params = new URLSearchParams();
  if (query.search) params.set("q", query.search);
  if (query.sectionId !== null) params.set("line", String(query.sectionId));
  if (query.sort !== "next-due") params.set("sort", query.sort);
  const search = params.toString();
  return search ? `/items?${search}` : "/items";
}

export type LineChip = { section: SectionDto | null; count: number };

export type ItemsView = {
  /** The rows to show: in the line, matching the search, in the chosen order. */
  rows: ItemSummaryDto[];
  /** "All lines", then each line, with how many items match the search. */
  chips: LineChip[];
  counts: ReturnType<typeof listCounts>;
};

const texts = new WeakMap<ItemSummaryDto, string>();

function textOf(item: ItemSummaryDto): string {
  let text = texts.get(item);
  if (text === undefined) {
    text = searchText(item);
    texts.set(item, text);
  }
  return text;
}

/**
 * The Items list for a query. Line chips count the items matching the search; while searching,
 * lines without a match drop out of the row, except the one selected.
 */
export function itemsView(
  items: readonly ItemSummaryDto[],
  sections: readonly SectionDto[],
  query: ItemsQuery,
  today: IsoDate,
): ItemsView {
  const words = searchWords(query.search);
  const found = words.length === 0 ? items : items.filter((item) => matches(textOf(item), words));

  const perSection = new Map<number, number>();
  for (const item of found)
    perSection.set(item.sectionId, (perSection.get(item.sectionId) ?? 0) + 1);
  const chips: LineChip[] = [
    { section: null, count: found.length },
    ...sections
      .map((section) => ({ section, count: perSection.get(section.id) ?? 0 }))
      .filter(
        (chip) => words.length === 0 || chip.count > 0 || chip.section.id === query.sectionId,
      ),
  ];

  const inLine =
    query.sectionId === null ? found : found.filter((item) => item.sectionId === query.sectionId);
  return {
    rows: sortItems(inLine, query.sort),
    chips,
    counts: listCounts(inLine, today),
  };
}
