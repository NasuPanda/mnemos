import { describe, expect, it } from "vitest";
import type { ItemDto, ReviewDto } from "../../worker/contract";
import { applyRating, confirmReview, revertRating, todayView, type TodayData } from "./today-data";

const TODAY = "2026-09-24";
const TOMORROW = "2026-09-25";

function item(id: number, dueOn: string, sectionId = 1): ItemDto {
  return {
    id,
    sectionId,
    name: `Item ${id}`,
    description: null,
    problemUrl: null,
    problemText: null,
    answerUrl: null,
    answerText: null,
    sideNote: null,
    stop: 2,
    dueOn,
    images: [],
  };
}

function review(id: number, itemId: number, nextDueOn: string): ReviewDto {
  return {
    id,
    itemId,
    reviewedOn: TODAY,
    confidence: "not_at_all",
    stopBefore: 2,
    stopAfter: 1,
    wasDueOn: TODAY,
    nextDueOn,
    manual: false,
  };
}

const data: TodayData = {
  date: TODAY,
  ladder: [1, 2, 3, 5, 7, 14, 28],
  sections: [
    { id: 1, name: "Graphs", code: "GR", line: "m2", position: 1 },
    { id: 2, name: "Data structures", code: "DS", line: "m3", position: 2 },
  ],
  items: [item(1, "2026-09-21"), item(2, TODAY), item(3, TODAY, 2)],
  reviewsToday: [review(90, 50, "2026-09-27")],
  tomorrow: { date: TOMORROW, itemIds: [60] },
};

describe("Today's data on the client", () => {
  it("counts and orders today with src/core", () => {
    const view = todayView(data);
    expect(view.counts).toEqual({ left: 3, late: 1, done: 1 });
    expect(view.list.map((entry) => entry.item.id)).toEqual([1, 2, 3]);
    expect(view.lines).toEqual(
      new Map([
        [1, 2],
        [2, 1],
      ]),
    );
    expect(view.tomorrow).toEqual({ date: TOMORROW, due: 1, reviewedToday: 0 });
  });

  it("takes a rated item off today's list and counts it as done, at once", () => {
    const after = applyRating(data, item(2, TODAY), review(-1, 2, "2026-09-27"));
    expect(todayView(after).counts).toEqual({ left: 2, late: 1, done: 2 });
    expect(after.items.map((i) => i.id)).toEqual([1, 3]);
  });

  it("adds an item rated onto tomorrow to tomorrow's count, as reviewed today", () => {
    const after = applyRating(data, item(1, "2026-09-21"), review(-1, 1, TOMORROW));
    expect(todayView(after).tomorrow).toEqual({ date: TOMORROW, due: 2, reviewedToday: 1 });
  });

  it("puts the item back exactly as it was when a rating is undone", () => {
    const rated = applyRating(data, item(1, "2026-09-21"), review(-1, 1, TOMORROW));
    const undone = revertRating(rated, item(1, "2026-09-21"), -1);
    expect(undone).toEqual(data);
  });

  it("swaps the temporary id for the stored review's id once the Worker confirms", () => {
    const rated = applyRating(data, item(2, TODAY), review(-1, 2, "2026-09-27"));
    const confirmed = confirmReview(rated, -1, review(91, 2, "2026-09-27"));
    expect(confirmed.reviewsToday.map((r) => r.id)).toEqual([90, 91]);
  });
});
