import { describe, expect, it } from "vitest";
import type { ItemSummaryDto, SectionDto } from "../../worker/contract";
import { commands, ITEM_RESULTS } from "./commands";

const graphs: SectionDto = { id: 1, name: "Gráfok", code: "GRA", line: "m2", position: 0 };
const os: SectionDto = { id: 2, name: "Operating systems", code: "OS", line: "m3", position: 1 };

const item = (id: number, name: string, sectionId = 1): ItemSummaryDto => ({
  id,
  sectionId,
  name,
  description: null,
  problemText: "Mentions heap somewhere",
  sideNote: null,
  stop: 1,
  dueOn: "2026-10-17",
  reviewedToday: false,
});

const items = [
  item(1, "Why Dijkstra fails on negative edges"),
  item(2, "Dijkstra with a binary heap"),
  item(3, "Mutex vs semaphore", 2),
];

const run = (query: string, lines = new Map([[1, 2]]), list: ItemSummaryDto[] | null = items) =>
  commands({ query, sections: [graphs, os], lines, items: list });

describe("the command menu", () => {
  it("lists the places, the lines with items left and the rest, but no items, before a search", () => {
    const result = run("");
    expect(result.places.map((p) => p.label)).toEqual([
      "Review",
      "Flash review · 2",
      "Items",
      "Settings",
      "New item",
    ]);
    expect(result.lines.map((l) => l.section.code)).toEqual(["GRA"]);
    expect(result.items).toEqual([]);
    expect(result.other.map((o) => o.id)).toEqual(["shortcuts", "sign-out"]);
  });

  it("offers Flash review only while something is left today", () => {
    const result = run("", new Map());
    expect(result.places.map((p) => p.id)).not.toContain("flash");
    expect(result.lines).toEqual([]);
  });

  it("finds items by every word of their name, ignoring case and accents", () => {
    expect(run("dijkstra").items.map((i) => i.item.id)).toEqual([1, 2]);
    expect(run("DIJKSTRA heap").items.map((i) => i.item.id)).toEqual([2]);
    expect(run("dijkstra").items[0]).toMatchObject({ section: graphs, to: "/items/1" });
  });

  it("searches item names only, not their text", () => {
    expect(run("somewhere").items).toEqual([]);
  });

  it("shows at most a few items", () => {
    const many = Array.from({ length: 20 }, (_, i) => item(i + 1, `Heap ${i + 1}`));
    expect(run("heap", undefined, many).items).toHaveLength(ITEM_RESULTS);
  });

  it("finds a line by its name or code, ignoring accents", () => {
    expect(run("grafok").lines.map((l) => l.to)).toEqual(["/flash?section=1"]);
    expect(run("gra").lines).toHaveLength(1);
    expect(run("os").lines).toEqual([]); // nothing left on OS today
  });

  it("finds places and the rest by their other names", () => {
    expect(run("menetrend").places.map((p) => p.id)).toEqual(["settings"]);
    expect(run("logout").other.map((o) => o.id)).toEqual(["sign-out"]);
    expect(run("keys").other.map((o) => o.id)).toEqual(["shortcuts"]);
  });

  it("finds nothing among items while the list loads", () => {
    expect(run("dijkstra", undefined, null).items).toEqual([]);
  });
});
