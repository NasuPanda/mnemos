import { describe, expect, it } from "vitest";
import type { ItemDto, PastReviewDto, SectionDto } from "../../worker/contract";
import {
  blankStrip,
  dayKind,
  futureDayView,
  pastDayView,
  stripDays,
  swipedDay,
  withMovedItem,
  withoutDayItem,
  type DayData,
} from "./day-data";

// The design draft's week, seen on Thursday 24 September 2026.
const TODAY = "2026-09-24";
const FRIDAY = "2026-09-25";
const WEEK = ["2026-09-21", "2026-09-22", "2026-09-23", TODAY, FRIDAY, "2026-09-26", "2026-09-27"];

const sections: SectionDto[] = [
  { id: 1, name: "Graphs", code: "GR", line: "m2", position: 1 },
  { id: 2, name: "Data structures", code: "DS", line: "m3", position: 2 },
];

function item(id: number, dueOn: string, sectionId = 1, stop = 2): ItemDto {
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
    stop,
    dueOn,
    images: [],
  };
}

function pastReview(id: number, itemId: number, sectionId: number): PastReviewDto {
  return {
    id,
    itemId,
    reviewedOn: "2026-09-21",
    confidence: "confident",
    stopBefore: 1,
    stopAfter: 2,
    wasDueOn: "2026-09-21",
    nextDueOn: "2026-09-23",
    manual: false,
    name: `Item ${itemId}`,
    sectionId,
  };
}

const friday: DayData = {
  date: FRIDAY,
  today: TODAY,
  week: {
    days: WEEK,
    due: [
      { id: 1, dueOn: FRIDAY },
      { id: 2, dueOn: FRIDAY },
      { id: 3, dueOn: FRIDAY },
      { id: 9, dueOn: "2026-09-27" },
    ],
    reviews: [
      { itemId: 20, reviewedOn: "2026-09-21" },
      { itemId: 21, reviewedOn: "2026-09-21" },
      { itemId: 20, reviewedOn: "2026-09-22" },
    ],
  },
  items: [item(1, FRIDAY), item(2, FRIDAY, 2), item(3, FRIDAY)],
  reviews: [],
};

describe("Other days on the client", () => {
  it("tells past, today and future apart by the browser's today", () => {
    expect(dayKind("2026-09-21", TODAY)).toBe("past");
    expect(dayKind(TODAY, TODAY)).toBe("today");
    expect(dayKind(FRIDAY, TODAY)).toBe("future");
  });

  it("shows the week strip: reviews done on past days, Left today, items due ahead", () => {
    expect(stripDays(friday.week, TODAY, 38).map((day) => day.count)).toEqual([
      { kind: "past", done: 2 },
      { kind: "past", done: 1 },
      { kind: "past", done: 0 },
      { kind: "today", left: 38 },
      { kind: "future", due: 3 },
      { kind: "future", due: 0 },
      { kind: "future", due: 1 },
    ]);
  });

  it("shows a week's dates before its counts arrive, with today's Left when today is in it", () => {
    expect(blankStrip(FRIDAY, TODAY, 38).map((day) => [day.date, day.count])).toEqual([
      ["2026-09-21", null],
      ["2026-09-22", null],
      ["2026-09-23", null],
      [TODAY, { kind: "today", left: 38 }],
      [FRIDAY, null],
      ["2026-09-26", null],
      ["2026-09-27", null],
    ]);
    expect(blankStrip("2026-10-01", TODAY, 38).every((day) => day.count === null)).toBe(true);
  });

  it("moves a week when the phone's strip is swiped to the next or previous week", () => {
    expect(swipedDay(FRIDAY, 2)).toBe("2026-10-02");
    expect(swipedDay(FRIDAY, 0)).toBe("2026-09-18");
    expect(swipedDay("2026-12-30", 2)).toBe("2027-01-06");
    // Settling back on the middle week changes nothing.
    expect(swipedDay(FRIDAY, 1)).toBeNull();
  });

  it("dims Friday's items reviewed today and counts Early without them (page 10)", () => {
    const view = futureDayView(friday, sections, new Set([1]));
    expect(view.counts).toEqual({ due: 3, reviewedToday: 1, early: 2 });
    expect(view.list.map((entry) => [entry.item.id, entry.reviewedToday])).toEqual([
      [3, false],
      [1, true],
      [2, false],
    ]);
    expect(view.lines.get(1)).toEqual({ due: 2, reviewedToday: 1, early: 1 });
    expect(view.lines.get(2)).toEqual({ due: 1, reviewedToday: 0, early: 1 });
  });

  it("lists a past day's reviews by line, then in the order made", () => {
    const monday: DayData = {
      ...friday,
      date: "2026-09-21",
      items: [],
      reviews: [pastReview(30, 20, 2), pastReview(31, 21, 1), pastReview(32, 22, 2)],
    };
    expect(pastDayView(monday, sections).map((review) => review.id)).toEqual([31, 30, 32]);
  });

  it("leaves out rows of a section it doesn't know yet instead of failing", () => {
    const stale = { ...friday, items: [...friday.items, item(4, FRIDAY, 99)] };
    expect(futureDayView(stale, sections, new Set()).counts.due).toBe(3);
  });

  describe("an item rated early from Friday", () => {
    it("leaves Friday when it lands on a later day, and joins that day's count", () => {
      const moved = withMovedItem(friday, { ...item(3, FRIDAY), dueOn: "2026-09-27", stop: 3 });
      expect(moved.items.map((i) => i.id)).toEqual([1, 2]);
      expect(moved.week.due).toEqual([
        { id: 1, dueOn: FRIDAY },
        { id: 2, dueOn: FRIDAY },
        { id: 3, dueOn: "2026-09-27" },
        { id: 9, dueOn: "2026-09-27" },
      ]);
    });

    it("stays on Friday when Not at all brings it back the next day", () => {
      const moved = withMovedItem(friday, { ...item(3, FRIDAY), stop: 1 });
      expect(moved.items.find((i) => i.id === 3)?.stop).toBe(1);
      expect(moved.week.due).toHaveLength(4);
    });

    it("leaves the week's counts when it lands after Sunday", () => {
      const moved = withMovedItem(friday, item(3, "2026-10-08"));
      expect(moved.week.due.map((row) => row.id)).toEqual([1, 2, 9]);
    });

    it("comes back as it was on Undo", () => {
      const rated = withMovedItem(friday, item(3, "2026-10-08"));
      expect(withMovedItem(rated, item(3, FRIDAY))).toEqual(friday);
    });
  });

  it("adds an item rated from today's list that lands on Friday", () => {
    const moved = withMovedItem(friday, item(7, FRIDAY));
    expect(moved.items.map((i) => i.id)).toEqual([1, 2, 3, 7]);
    expect(moved.week.due.filter((row) => row.dueOn === FRIDAY)).toHaveLength(4);
  });

  it("never lists an item due today or earlier on the week's future counts", () => {
    const moved = withMovedItem(friday, item(3, TODAY));
    expect(moved.week.due.map((row) => row.id)).toEqual([1, 2, 9]);
    expect(moved.items.map((i) => i.id)).toEqual([1, 2]);
  });

  it("forgets a deleted item everywhere, its past reviews too", () => {
    const monday: DayData = { ...friday, date: "2026-09-21", reviews: [pastReview(30, 20, 1)] };
    const gone = withoutDayItem(monday, 20);
    expect(gone.reviews).toEqual([]);
    expect(gone.week.reviews).toEqual([{ itemId: 21, reviewedOn: "2026-09-21" }]);
    expect(withoutDayItem(friday, 1).items.map((i) => i.id)).toEqual([2, 3]);
  });
});
