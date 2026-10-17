import { describe, expect, it } from "vitest";
import type { ItemHistoryResponse, ReviewDto } from "../../worker/contract";
import { axisDate, axisDay, historyView, move } from "./history-view";

const LADDER = [1, 2, 3, 5, 7, 14, 28];
const TODAY = "2026-09-24";

let nextId = 1;
function review(
  reviewedOn: string,
  confidence: ReviewDto["confidence"],
  stopBefore: number,
  stopAfter: number,
  wasDueOn: string,
  nextDueOn: string,
  manual = false,
): ReviewDto {
  return {
    id: nextId++,
    itemId: 1,
    reviewedOn,
    confidence,
    stopBefore,
    stopAfter,
    wasDueOn,
    nextDueOn,
    manual,
  };
}

/** The design draft's Dijkstra history, newest first as the API sends it (page 20). */
const dijkstra: ItemHistoryResponse = {
  item: {
    id: 1,
    sectionId: 1,
    name: "Why Dijkstra fails on negative edges",
    stop: 4,
    dueOn: "2026-09-21",
  },
  reviews: [
    review("2026-09-16", "confident", 3, 4, "2026-09-15", "2026-09-21"),
    review("2026-09-12", "confident", 2, 3, "2026-09-13", "2026-09-15"),
    review("2026-09-11", "confident", 1, 2, "2026-09-11", "2026-09-13"),
    review("2026-09-10", "not_at_all", 3, 1, "2026-09-10", "2026-09-11"),
    review("2026-09-07", "confident", 2, 3, "2026-09-07", "2026-09-10"),
    review("2026-09-04", "confident", 1, 2, "2026-09-04", "2026-09-07", true),
    review("2026-09-03", "neutral", 1, 1, "2026-09-03", "2026-09-04"),
  ],
};

describe("An item's history (page 20)", () => {
  const view = historyView(dijkstra, LADDER, TODAY);

  it("draws the reviews oldest first, each at the stop it landed on", () => {
    expect(view.points.map((p) => [p.review.reviewedOn, p.stop])).toEqual([
      ["2026-09-03", 1],
      ["2026-09-04", 2],
      ["2026-09-07", 3],
      ["2026-09-10", 1],
      ["2026-09-11", 2],
      ["2026-09-12", 3],
      ["2026-09-16", 4],
    ]);
  });

  it("lists them newest first in the table", () => {
    expect(view.rows.map((p) => p.review.reviewedOn)[0]).toBe("2026-09-16");
  });

  it("sizes each dot by confidence: 16, 12 and 8 px", () => {
    expect(view.points.map((p) => p.size)).toEqual([12, 16, 16, 8, 16, 16, 16]);
  });

  it("marks the date picked on 4 Sep and the review a day early on 12 Sep", () => {
    expect(view.points.filter((p) => p.picked).map((p) => p.review.reviewedOn)).toEqual([
      "2026-09-04",
    ]);
    expect(view.points.filter((p) => p.early).map((p) => [p.review.reviewedOn, p.early])).toEqual([
      ["2026-09-12", 1],
    ]);
  });

  it("explains a dot: Sat 12 Sep · Confident · 1 day early, up to stop 3 · next Tue 15 Sep", () => {
    const twelfth = view.points[5];
    expect(twelfth?.title).toBe("Sat 12 Sep · Confident · 1 day early");
    expect(twelfth?.detail).toBe("up to stop 3 · next Tue 15 Sep");
    expect(view.points[1]?.detail).toBe("up to stop 2 · next Mon 7 Sep (picked)");
  });

  it("says where the item is now: on stop 4 since 16 Sep, due Mon 21 Sep, +3 days", () => {
    expect(view.now).toEqual({ stop: 4, since: "2026-09-16", dueOn: "2026-09-21", daysLate: 3 });
  });

  it("draws the ladder's stops, or more if an older review sits higher", () => {
    expect(view.stops).toBe(7);
    // After two stops were removed, the old reviews keep their numbers.
    expect(historyView(dijkstra, [1, 2, 3], TODAY).stops).toBe(4);
  });

  it("knows no 'since' once the item has moved without a review (a stop removed)", () => {
    const moved = { ...dijkstra, item: { ...dijkstra.item, stop: 3 } };
    expect(historyView(moved, LADDER, TODAY).now.since).toBeNull();
  });

  it("has nothing to draw for an item never reviewed", () => {
    const fresh = historyView({ ...dijkstra, reviews: [] }, LADDER, TODAY);
    expect(fresh.points).toEqual([]);
    expect(fresh.now.since).toBeNull();
  });

  it("words each move and each date on the axis", () => {
    expect(move({ stopBefore: 2, stopAfter: 3 })).toBe("up to stop 3");
    expect(move({ stopBefore: 7, stopAfter: 7 })).toBe("stays on stop 7");
    expect(move({ stopBefore: 3, stopAfter: 1 })).toBe("back to stop 1");
    expect(axisDate("2026-09-03")).toBe("3 Sep");
    expect(axisDay("2026-09-03")).toBe("3");
  });
});
