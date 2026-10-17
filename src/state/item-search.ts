import type { ItemSummaryDto } from "../../worker/contract";

/** Lowercase without accents, so "grafok" finds "Gráfok" and "HEAP" finds "heap". */
export function foldText(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** The words of a search, folded; an empty search has none. */
export function searchWords(query: string): string[] {
  return foldText(query).split(/\s+/).filter(Boolean);
}

/** What search looks through: Name, Description, Problem description and Side note. */
export function searchText(item: ItemSummaryDto): string {
  return foldText(
    [item.name, item.description, item.problemText, item.sideNote].filter(Boolean).join("\n"),
  );
}

/** An item matches when every word of the search appears somewhere in its text. */
export function matches(text: string, words: readonly string[]): boolean {
  return words.every((word) => text.includes(word));
}
