import { describe, expect, it } from "vitest";
import type { ItemSummaryDto } from "../../worker/contract";
import { foldText, matches, searchText, searchWords } from "./item-search";

function item(fields: Partial<ItemSummaryDto>): ItemSummaryDto {
  return {
    id: 1,
    sectionId: 1,
    name: "",
    description: null,
    problemText: null,
    sideNote: null,
    stop: 1,
    dueOn: "2026-09-24",
    reviewedToday: false,
    ...fields,
  };
}

const finds = (query: string, fields: Partial<ItemSummaryDto>) =>
  matches(searchText(item(fields)), searchWords(query));

describe("Items search", () => {
  it("looks through the name, description, problem description and side note", () => {
    expect(finds("heap", { name: "Binary heap `siftDown`" })).toBe(true);
    expect(finds("exam", { description: "Came up in last year's exam." })).toBe(true);
    expect(finds("fig", { problemText: "Run Dijkstra on the graph in Fig. 1." })).toBe(true);
    expect(finds("bellman", { sideNote: "Reach for Bellman–Ford." })).toBe(true);
  });

  it("ignores case and accents", () => {
    expect(finds("GRAFOK", { name: "Gráfok" })).toBe(true);
    expect(finds("gráf", { name: "grafok" })).toBe(true);
    expect(foldText("Ütemező")).toBe("utemezo");
  });

  it("needs every word, in any order and any field", () => {
    expect(finds("heap dijkstra", { name: "Dijkstra with a binary heap" })).toBe(true);
    expect(finds("heap negative", { name: "Dijkstra with a binary heap" })).toBe(false);
    expect(finds("dijkstra exam", { name: "Dijkstra", description: "exam" })).toBe(true);
  });

  it("matches everything when the search is empty", () => {
    expect(searchWords("   ")).toEqual([]);
    expect(finds("", { name: "Anything" })).toBe(true);
  });
});
