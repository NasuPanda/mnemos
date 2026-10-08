import { describe, expect, it } from "vitest";
import {
  futureDayCounts,
  futureDayList,
  lineCounts,
  reviewQueue,
  stripCount,
  todayCounts,
  todayList,
  type ScheduledItem,
  type SectionRef,
} from "./day";
import { DEFAULT_LADDER } from "./ladder";
import { itemAfter, rate } from "./rating";
import {
  afternoonRating,
  ALL_ITEMS,
  DUE_FRIDAY,
  FRIDAY,
  LEFT_TODAY,
  MORNING_REVIEWS,
  SECTIONS,
  TODAY,
  type ScenarioItem,
} from "./test/scenario";

const reviewedIds = (reviews: readonly { itemId: number }[]) =>
  new Set(reviews.map((review) => review.itemId));

const byName = (name: string) => {
  const found = ALL_ITEMS.find((item) => item.name === name);
  if (!found) throw new Error(`no item named ${name}`);
  return found;
};

/** Plays out the rest of Thursday from page 01: every item left is rated once. */
function finishThursday() {
  const items = new Map<number, ScenarioItem>(ALL_ITEMS.map((item) => [item.id, item]));
  const reviews = [...MORNING_REVIEWS];
  for (const item of todayList(ALL_ITEMS, SECTIONS, reviewedIds(reviews), TODAY)) {
    const result = rate({
      item: item.item,
      ladder: DEFAULT_LADDER,
      today: TODAY,
      confidence: afternoonRating(item.item),
      reviewedToday: false,
    });
    if (!result.ok) throw new Error(result.error);
    items.set(item.item.id, { ...item.item, ...itemAfter(result.value) });
    reviews.push({ itemId: item.item.id, reviewedOn: TODAY });
  }
  return { items: [...items.values()], reviews };
}

describe("Counts on Thu 24 Sep, mid-morning (page 01)", () => {
  const reviewed = reviewedIds(MORNING_REVIEWS);

  it("shows 38 left today · 7 of them late · 9 done", () => {
    expect(todayCounts(ALL_ITEMS, MORNING_REVIEWS, TODAY)).toEqual({ left: 38, late: 7, done: 9 });
  });

  it("counts Late as part of Left, never on top of it", () => {
    const { left, late } = todayCounts(ALL_ITEMS, MORNING_REVIEWS, TODAY);
    expect(late).toBeLessThanOrEqual(left);
    expect(todayList(ALL_ITEMS, SECTIONS, reviewed, TODAY)).toHaveLength(left);
  });

  it("gives each section its Line count, as the sidebar shows (Graphs 8, Data structures 6 …)", () => {
    const lines = lineCounts(ALL_ITEMS, reviewed, TODAY);
    for (const section of SECTIONS) {
      expect(lines.get(section.id) ?? 0, section.code).toBe(section.left);
    }
  });

  it("adds the Line counts up to Left", () => {
    const total = [...lineCounts(ALL_ITEMS, reviewed, TODAY).values()].reduce((a, b) => a + b, 0);
    expect(total).toBe(38);
  });

  it("shows Friday with 12 due before any of today's ratings land there", () => {
    expect(futureDayCounts(ALL_ITEMS, reviewed, FRIDAY, TODAY)).toEqual({
      due: 12,
      reviewedToday: 0,
      early: 12,
    });
  });
});

describe("Counts at the end of Thu 24 Sep (pages 05 and 10)", () => {
  it("adds 38 left and 9 done up to 47 done, with nothing left", () => {
    const { items, reviews } = finishThursday();
    expect(todayCounts(items, reviews, TODAY)).toEqual({ left: 0, late: 0, done: 47 });
  });

  it("counts Friday's Due with the 5 items rated today that landed there: 17 due", () => {
    const { items, reviews } = finishThursday();
    expect(futureDayCounts(items, reviewedIds(reviews), FRIDAY, TODAY).due).toBe(17);
  });

  it("gives Review early · 12 on Friday: 17 due minus 5 reviewed today", () => {
    const { items, reviews } = finishThursday();
    expect(futureDayCounts(items, reviewedIds(reviews), FRIDAY, TODAY)).toEqual({
      due: 17,
      reviewedToday: 5,
      early: 12,
    });
    expect(
      reviewQueue(items, {
        sections: SECTIONS,
        reviewedToday: reviewedIds(reviews),
        today: TODAY,
        day: FRIDAY,
      }),
    ).toHaveLength(12);
  });

  it("counts an early review toward today's Done and Friday's reviewed, not toward Left", () => {
    const { items, reviews } = finishThursday();
    const early = byName("Dijkstra with a binary heap");
    const result = rate({
      item: early,
      ladder: DEFAULT_LADDER,
      today: TODAY,
      confidence: "confident",
      reviewedToday: false,
    });
    if (!result.ok) throw new Error(result.error);
    const after = items.map((i) => (i.id === early.id ? { ...i, ...itemAfter(result.value) } : i));
    const reviewsAfter = [...reviews, { itemId: early.id, reviewedOn: TODAY }];

    expect(todayCounts(after, reviewsAfter, TODAY)).toEqual({ left: 0, late: 0, done: 48 });
    // It moved on to a later day, so Friday now has 16 due, 5 of them reviewed today.
    expect(futureDayCounts(after, reviewedIds(reviewsAfter), FRIDAY, TODAY)).toEqual({
      due: 16,
      reviewedToday: 5,
      early: 11,
    });
  });

  it("lists Friday's reviewed-today items last in their section (Graphs on page 10)", () => {
    const { items, reviews } = finishThursday();
    const graphs = futureDayList(items, SECTIONS, reviewedIds(reviews), FRIDAY, TODAY)
      .filter((entry) => entry.item.sectionId === 1)
      .map((entry) => [entry.item.name, entry.reviewedToday]);
    // Bellman–Ford was created first, but it was reviewed today, so it comes after.
    expect(graphs).toEqual([
      ["Dijkstra with a binary heap", false],
      ["Bellman–Ford: detect a negative cycle", true],
    ]);
  });
});

describe("Order: section order, then most days late first, then the ones due today", () => {
  const reviewed = reviewedIds(MORNING_REVIEWS);

  it("lists Graphs as page 01 does: +3, +1, +1, then the items due today", () => {
    const graphs = todayList(ALL_ITEMS, SECTIONS, reviewed, TODAY)
      .filter((entry) => entry.item.sectionId === 1)
      .map((entry) => [entry.item.name, entry.daysLate]);
    expect(graphs).toEqual([
      ["Why Dijkstra fails on negative edges", 3],
      ["Bellman–Ford: detect a negative cycle", 1],
      ["Tarjan’s strongly connected components", 1],
      ["Topological sort with Kahn’s algorithm", 0],
      ["Floyd–Warshall path reconstruction", 0],
      ["Bipartite check with BFS colouring", 0],
      ["Kruskal vs Prim: when to use which", 0],
      ["A* with an admissible heuristic", 0],
    ]);
  });

  it("goes section by section in section order", () => {
    const sectionsInOrder = todayList(ALL_ITEMS, SECTIONS, reviewed, TODAY).map(
      (entry) => entry.item.sectionId,
    );
    expect([...new Set(sectionsInOrder)]).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(todayList(ALL_ITEMS, SECTIONS, reviewed, TODAY).map((e) => e.item.id)).toEqual(
      LEFT_TODAY.map((item) => item.id),
    );
  });

  it("follows the sections' position, not when they were created", () => {
    const items: ScheduledItem[] = [
      { id: 1, sectionId: 10, dueOn: TODAY },
      { id: 2, sectionId: 20, dueOn: TODAY },
    ];
    const sections: SectionRef[] = [
      { id: 10, position: 2 },
      { id: 20, position: 1 },
    ];
    expect(todayList(items, sections, new Set(), TODAY).map((e) => e.item.id)).toEqual([2, 1]);
  });

  it("puts the most days late first", () => {
    const items: ScheduledItem[] = [
      { id: 1, sectionId: 1, dueOn: "2026-09-23" },
      { id: 2, sectionId: 1, dueOn: TODAY },
      { id: 3, sectionId: 1, dueOn: "2026-09-14" },
    ];
    const entries = todayList(items, [{ id: 1, position: 1 }], new Set(), TODAY);
    expect(entries.map((e) => [e.item.id, e.daysLate])).toEqual([
      [3, 10],
      [1, 1],
      [2, 0],
    ]);
  });

  it("orders equally late items by creation, oldest first", () => {
    const items: ScheduledItem[] = [
      { id: 9, sectionId: 1, dueOn: "2026-09-23" },
      { id: 4, sectionId: 1, dueOn: "2026-09-23" },
      { id: 7, sectionId: 1, dueOn: TODAY },
      { id: 2, sectionId: 1, dueOn: TODAY },
    ];
    const ids = todayList(items, [{ id: 1, position: 1 }], new Set(), TODAY).map((e) => e.item.id);
    expect(ids).toEqual([4, 9, 2, 7]);
  });

  it("leaves out items due later and items already reviewed today", () => {
    const items: ScheduledItem[] = [
      { id: 1, sectionId: 1, dueOn: TODAY },
      { id: 2, sectionId: 1, dueOn: FRIDAY },
      { id: 3, sectionId: 1, dueOn: "2026-09-20" },
    ];
    const ids = todayList(items, [{ id: 1, position: 1 }], new Set([3]), TODAY).map(
      (e) => e.item.id,
    );
    expect(ids).toEqual([1]);
  });

  it("orders a future day by section, then creation, with reviewed-today items last", () => {
    const items: ScheduledItem[] = [
      { id: 1, sectionId: 1, dueOn: FRIDAY },
      { id: 2, sectionId: 1, dueOn: FRIDAY },
      { id: 3, sectionId: 1, dueOn: FRIDAY },
      { id: 4, sectionId: 2, dueOn: FRIDAY },
    ];
    const sections = [
      { id: 1, position: 1 },
      { id: 2, position: 2 },
    ];
    const entries = futureDayList(items, sections, new Set([1]), FRIDAY, TODAY);
    expect(entries.map((e) => [e.item.id, e.reviewedToday])).toEqual([
      [2, false],
      [3, false],
      [1, true],
      [4, false],
    ]);
  });
});

describe("Flash review uses the dashboard's order", () => {
  const reviewed = reviewedIds(MORNING_REVIEWS);

  it("runs over everything left today, in the same order as the dashboard (1 of 38 …)", () => {
    const queue = reviewQueue(ALL_ITEMS, {
      sections: SECTIONS,
      reviewedToday: reviewed,
      today: TODAY,
    });
    expect(queue.map((item) => item.id)).toEqual(
      todayList(ALL_ITEMS, SECTIONS, reviewed, TODAY).map((entry) => entry.item.id),
    );
    expect(queue[0]?.name).toBe("Why Dijkstra fails on negative edges");
  });

  it("can run over one section only (Shift+F), in the same order", () => {
    const queue = reviewQueue(ALL_ITEMS, {
      sections: SECTIONS,
      reviewedToday: reviewed,
      today: TODAY,
      sectionId: 2,
    });
    expect(queue.map((item) => item.name)).toEqual([
      "Union-find with path compression",
      "LRU cache: hash map + linked list",
      "Binary heap siftDown",
      "Trie: insert and prefix search",
      "Segment tree with lazy propagation",
      "Monotonic stack: next greater element",
    ]);
  });

  it("reviews a future day early, skipping the items already reviewed today", () => {
    const queue = reviewQueue(ALL_ITEMS, {
      sections: SECTIONS,
      reviewedToday: new Set([DUE_FRIDAY[0]!.id]),
      today: TODAY,
      day: FRIDAY,
    });
    expect(queue).toHaveLength(11);
    expect(queue.map((item) => item.id)).not.toContain(DUE_FRIDAY[0]!.id);
  });
});

describe("Other days in the week strip", () => {
  const items: ScheduledItem[] = [
    { id: 1, sectionId: 1, dueOn: "2026-09-21" }, // missed, still left today
    { id: 2, sectionId: 1, dueOn: TODAY },
    { id: 3, sectionId: 1, dueOn: FRIDAY },
    { id: 4, sectionId: 1, dueOn: FRIDAY },
  ];
  const reviews = [
    { itemId: 7, reviewedOn: "2026-09-21" },
    { itemId: 8, reviewedOn: "2026-09-21" },
    { itemId: 9, reviewedOn: "2026-09-22" },
    { itemId: 4, reviewedOn: TODAY },
  ];

  it("shows a past day's reviews done; missed items don't appear there", () => {
    expect(stripCount("2026-09-21", TODAY, { items, reviews })).toEqual({ kind: "past", done: 2 });
    expect(stripCount("2026-09-23", TODAY, { items, reviews })).toEqual({ kind: "past", done: 0 });
  });

  it("shows today's items left", () => {
    expect(stripCount(TODAY, TODAY, { items, reviews })).toEqual({ kind: "today", left: 2 });
  });

  it("shows a future day's items due, including ones reviewed today", () => {
    expect(stripCount(FRIDAY, TODAY, { items, reviews })).toEqual({ kind: "future", due: 2 });
  });

  it("refuses to treat today or a past day as a future day", () => {
    expect(() => futureDayCounts(items, new Set(), TODAY, TODAY)).toThrow(RangeError);
    expect(() =>
      futureDayList(items, [{ id: 1, position: 1 }], new Set(), "2026-09-20", TODAY),
    ).toThrow(RangeError);
  });

  it("refuses an item whose section isn't in the list instead of misplacing it", () => {
    expect(() => todayList([{ id: 1, sectionId: 99, dueOn: TODAY }], [], new Set(), TODAY)).toThrow(
      RangeError,
    );
  });
});
