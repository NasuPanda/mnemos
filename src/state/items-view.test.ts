import { describe, expect, it } from "vitest";
import type { ItemSummaryDto, SectionDto } from "../../worker/contract";
import { itemsPath, itemsView, parseItemsQuery, type ItemsQuery } from "./items-view";

const TODAY = "2026-09-24";

const sections: SectionDto[] = [
  { id: 1, name: "Graphs", code: "GR", line: "m2", position: 1 },
  { id: 2, name: "Data structures", code: "DS", line: "m3", position: 2 },
  { id: 3, name: "Python", code: "PY", line: "m2", position: 3 },
];

function item(id: number, sectionId: number, name: string, dueOn = TODAY): ItemSummaryDto {
  return {
    id,
    sectionId,
    name,
    description: null,
    problemText: null,
    sideNote: null,
    stop: 1,
    dueOn,
    reviewedToday: false,
  };
}

const items = [
  item(1, 1, "Dijkstra with a binary heap", "2026-09-25"),
  item(2, 1, "Why Dijkstra fails on negative edges", "2026-09-21"),
  item(3, 2, "Binary heap siftDown"),
  item(4, 2, "Priority queue with a pairing heap", "2026-10-12"),
  item(5, 3, "List comprehensions"),
];

const query = (q: Partial<ItemsQuery> = {}): ItemsQuery => ({
  search: "",
  sectionId: null,
  sort: "next-due",
  ...q,
});

describe("Items list › filter, search and sort", () => {
  it("shows every item by next due, with a chip per line counting its items", () => {
    const view = itemsView(items, sections, query(), TODAY);
    expect(view.rows.map((i) => i.id)).toEqual([2, 3, 5, 1, 4]);
    expect(view.chips.map((c) => [c.section?.code ?? "All", c.count])).toEqual([
      ["All", 5],
      ["GR", 2],
      ["DS", 2],
      ["PY", 1],
    ]);
  });

  it("filters by one line, and sums up only that line", () => {
    const view = itemsView(items, sections, query({ sectionId: 1 }), TODAY);
    expect(view.rows.map((i) => i.id)).toEqual([2, 1]);
    expect(view.counts).toEqual({ items: 2, late: 1, dueToday: 0, reviewedToday: 0 });
  });

  it("counts search matches on each chip and leaves out lines without one", () => {
    const view = itemsView(items, sections, query({ search: "heap" }), TODAY);
    expect(view.rows.map((i) => i.id)).toEqual([3, 1, 4]);
    expect(view.chips.map((c) => [c.section?.code ?? "All", c.count])).toEqual([
      ["All", 3],
      ["GR", 1],
      ["DS", 2],
    ]);
  });

  it("keeps the selected line's chip even when nothing in it matches", () => {
    const view = itemsView(items, sections, query({ search: "heap", sectionId: 3 }), TODAY);
    expect(view.rows).toEqual([]);
    expect(view.chips.map((c) => c.section?.code ?? "All")).toEqual(["All", "GR", "DS", "PY"]);
  });

  it("can put the newest items first", () => {
    const view = itemsView(items, sections, query({ sort: "recently-added" }), TODAY);
    expect(view.rows.map((i) => i.id)).toEqual([5, 4, 3, 2, 1]);
  });
});

describe("Items list › kept in the URL", () => {
  it("reads and writes only what differs from the plain list", () => {
    expect(itemsPath(query())).toBe("/items");
    const path = itemsPath(query({ search: "binary heap", sectionId: 2, sort: "recently-added" }));
    expect(path).toBe("/items?q=binary+heap&line=2&sort=recently-added");
    expect(parseItemsQuery(new URL(path, "http://x").searchParams)).toEqual({
      search: "binary heap",
      sectionId: 2,
      sort: "recently-added",
    });
  });

  it("falls back to the plain list for anything it doesn't know", () => {
    expect(parseItemsQuery(new URLSearchParams("line=x&sort=name"))).toEqual(query());
  });
});
