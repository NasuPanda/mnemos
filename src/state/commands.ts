import { editItemPath, flashPath, newItemPath } from "@/lib/routes";
import { foldText, matches, searchWords } from "@/state/item-search";
import type { ItemSummaryDto, SectionDto } from "../../worker/contract";

export type Place = { id: string; label: string; hint: string; to: string; keywords: string };
export type LineCommand = { section: SectionDto; left: number; to: string };
export type ItemCommand = { item: ItemSummaryDto; section: SectionDto | undefined; to: string };
export type OtherCommand = {
  id: "shortcuts" | "sign-out";
  label: string;
  hint?: string;
  keywords: string;
};

export type Commands = {
  places: Place[];
  lines: LineCommand[];
  items: ItemCommand[];
  other: OtherCommand[];
};

/** Items found by name at most; the Items screen's search goes further. */
export const ITEM_RESULTS = 8;

/**
 * What the command menu offers for a search: the places, a review of each line with items left
 * today, items whose name has every word of the search (ignoring case and accents), and the
 * shortcuts list and Sign out. An empty search lists everything but items.
 */
export function commands({
  query,
  sections,
  lines,
  items,
}: {
  query: string;
  sections: SectionDto[];
  /** Left today, per section id. */
  lines: Map<number, number>;
  /** Every item, or null while the list loads. */
  items: ItemSummaryDto[] | null;
}): Commands {
  const words = searchWords(query);
  const found = (text: string) => matches(foldText(text), words);
  const left = [...lines.values()].reduce((sum, n) => sum + n, 0);

  const places: Place[] = [
    { id: "review", label: "Review", hint: "T", to: "/", keywords: "today dashboard" },
    ...(left > 0
      ? [
          {
            id: "flash",
            label: `Flash review · ${left}`,
            hint: "F",
            to: flashPath(),
            keywords: "start",
          },
        ]
      : []),
    { id: "items", label: "Items", hint: "I", to: "/items", keywords: "list search" },
    {
      id: "settings",
      label: "Settings",
      hint: ",",
      to: "/settings",
      keywords: "menetrend timetable ladder stops lines account",
    },
    { id: "new-item", label: "New item", hint: "N", to: newItemPath(), keywords: "add create" },
  ];
  const other: OtherCommand[] = [
    { id: "shortcuts", label: "Keyboard shortcuts", hint: "?", keywords: "keys help" },
    { id: "sign-out", label: "Sign out", keywords: "log out logout account" },
  ];

  const bySection = new Map(sections.map((section) => [section.id, section]));
  return {
    places: places.filter((place) => found(`${place.label} ${place.keywords}`)),
    lines: sections
      .filter((section) => (lines.get(section.id) ?? 0) > 0)
      .filter((section) => found(`review line ${section.code} ${section.name}`))
      .map((section) => ({
        section,
        left: lines.get(section.id) ?? 0,
        to: flashPath({ sectionId: section.id }),
      })),
    items:
      words.length === 0 || !items
        ? []
        : items
            .filter((item) => found(item.name))
            .slice(0, ITEM_RESULTS)
            .map((item) => ({
              item,
              section: bySection.get(item.sectionId),
              to: editItemPath(item.id),
            })),
    other: other.filter((command) => found(`${command.label} ${command.keywords}`)),
  };
}
