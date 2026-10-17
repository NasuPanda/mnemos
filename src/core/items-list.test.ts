import { describe, expect, it } from "vitest";
import { todayCounts } from "./day";
import { itemStatus, listCounts, sortItems, type ListedItem } from "./items-list";

const TODAY = "2026-09-24";

function item(id: number, dueOn: string, reviewedToday = false): ListedItem {
  return { id, sectionId: 1, dueOn, reviewedToday };
}

describe("Items list › each row's status", () => {
  it("shows how many days late a late item is (today minus its due date)", () => {
    expect(itemStatus(item(1, "2026-09-21"), TODAY)).toEqual({ kind: "late", days: 3 });
  });

  it("says Due today for an item due today", () => {
    expect(itemStatus(item(1, TODAY), TODAY)).toEqual({ kind: "due-today" });
  });

  it("says Reviewed today for an item reviewed today, whatever its new due date", () => {
    expect(itemStatus(item(1, "2026-09-27", true), TODAY)).toEqual({ kind: "reviewed-today" });
  });

  it("shows nothing for an item due on a later day", () => {
    expect(itemStatus(item(1, "2026-09-25"), TODAY)).toEqual({ kind: "scheduled" });
  });
});

describe("Items list › sorted by next due", () => {
  it("puts the earliest due date first, so late items lead", () => {
    const items = [item(1, "2026-10-01"), item(2, "2026-09-21"), item(3, TODAY)];
    expect(sortItems(items, "next-due").map((i) => i.id)).toEqual([2, 3, 1]);
  });

  it("lists items due the same day in creation order, oldest first", () => {
    const items = [item(9, TODAY), item(4, TODAY), item(7, TODAY)];
    expect(sortItems(items, "next-due").map((i) => i.id)).toEqual([4, 7, 9]);
  });
});

describe("Items list › sorted by recently added", () => {
  it("puts the newest item first, whatever its due date", () => {
    const items = [item(1, "2026-09-21"), item(3, "2026-12-01"), item(2, TODAY)];
    expect(sortItems(items, "recently-added").map((i) => i.id)).toEqual([3, 2, 1]);
  });

  it("leaves the list it was given untouched", () => {
    const items = [item(2, TODAY), item(1, TODAY)];
    sortItems(items, "recently-added");
    expect(items.map((i) => i.id)).toEqual([2, 1]);
  });
});

describe("Items list › the summary line", () => {
  // The design draft's Graphs line: 23 items · 3 late · 5 more due today · 1 reviewed today.
  const graphs = [
    item(1, "2026-09-21"),
    item(2, "2026-09-23"),
    item(3, "2026-09-23"),
    ...[4, 5, 6, 7, 8].map((id) => item(id, TODAY)),
    item(9, "2026-09-27", true),
    ...Array.from({ length: 14 }, (_, i) => item(10 + i, "2026-10-01")),
  ];

  it("counts the items, the late ones, the rest due today and those reviewed today", () => {
    expect(listCounts(graphs, TODAY)).toEqual({
      items: 23,
      late: 3,
      dueToday: 5,
      reviewedToday: 1,
    });
  });

  it("splits Left the same way as the dashboard: late plus more due today is Left", () => {
    const { late, dueToday } = listCounts(graphs, TODAY);
    const reviews = graphs.filter((i) => i.reviewedToday).map((i) => ({ itemId: i.id }));
    const dashboard = todayCounts(graphs, reviews, TODAY);
    expect(late).toBe(dashboard.late);
    expect(late + dueToday).toBe(dashboard.left);
  });
});
