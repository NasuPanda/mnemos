import { describe, expect, it } from "vitest";
import { DEFAULT_LADDER, removeStop, setGap, stopAfterRemoval } from "./ladder";
import {
  itemAfter,
  moveOnLadder,
  newItemSchedule,
  rate,
  ratingOptions,
  undo,
  type Confidence,
  type RateInput,
  type Review,
} from "./rating";
import { daysLate, reviewTiming } from "./timing";

const THU_24_SEP = "2026-09-24";
const ladder = DEFAULT_LADDER;

/** Rates and unwraps, for tests where the rating must be accepted. */
function rated(input: Partial<RateInput> & Pick<RateInput, "item" | "confidence">): Review {
  const result = rate({ ladder, today: THU_24_SEP, reviewedToday: false, ...input });
  if (!result.ok) throw new Error(`rating refused: ${result.error}`);
  return result.value;
}

describe("Ladder moves", () => {
  it("Confident moves the item up one stop", () => {
    expect(moveOnLadder(4, "confident", ladder)).toBe(5);
    expect(moveOnLadder(1, "confident", ladder)).toBe(2);
  });

  it("Confident on the last stop stays on the last stop", () => {
    expect(moveOnLadder(7, "confident", ladder)).toBe(7);
  });

  it("Neutral keeps the item's stop", () => {
    expect(moveOnLadder(4, "neutral", ladder)).toBe(4);
    expect(moveOnLadder(7, "neutral", ladder)).toBe(7);
  });

  it("Not at all sends the item back to stop 1, even from the last stop", () => {
    expect(moveOnLadder(4, "not_at_all", ladder)).toBe(1);
    expect(moveOnLadder(7, "not_at_all", ladder)).toBe(1);
    expect(moveOnLadder(1, "not_at_all", ladder)).toBe(1);
  });

  it("follows the person's own ladder length", () => {
    expect(moveOnLadder(3, "confident", [1, 4, 9])).toBe(3);
  });

  it("refuses a stop that isn't on the ladder instead of guessing", () => {
    expect(() => moveOnLadder(8, "neutral", ladder)).toThrow(RangeError);
  });
});

describe("Next due date = review date + the gap of the stop the item lands on", () => {
  const stop4 = { stop: 4, dueOn: THU_24_SEP };

  it("Confident from stop 4 on Thu 24 Sep → Thu 1 Oct, stop 5", () => {
    expect(itemAfter(rated({ item: stop4, confidence: "confident" }))).toEqual({
      stop: 5,
      dueOn: "2026-10-01",
    });
  });

  it("Neutral from stop 4 on Thu 24 Sep → Tue 29 Sep, stop 4", () => {
    expect(itemAfter(rated({ item: stop4, confidence: "neutral" }))).toEqual({
      stop: 4,
      dueOn: "2026-09-29",
    });
  });

  it("Not at all from stop 4 on Thu 24 Sep → Fri 25 Sep, stop 1", () => {
    expect(itemAfter(rated({ item: stop4, confidence: "not_at_all" }))).toEqual({
      stop: 1,
      dueOn: "2026-09-25",
    });
  });

  it("Confident or Neutral on the last stop, rated Thu 24 Sep → Thu 22 Oct, stop 7", () => {
    for (const confidence of ["confident", "neutral"] satisfies Confidence[]) {
      expect(itemAfter(rated({ item: { stop: 7, dueOn: THU_24_SEP }, confidence }))).toEqual({
        stop: 7,
        dueOn: "2026-10-22",
      });
    }
  });

  it("shows each rating's date and stop on the buttons (page 13) and the preview (page 30)", () => {
    expect(ratingOptions(4, ladder, THU_24_SEP)).toEqual([
      { confidence: "confident", stopAfter: 5, nextDueOn: "2026-10-01", gapDays: 7 },
      { confidence: "neutral", stopAfter: 4, nextDueOn: "2026-09-29", gapDays: 5 },
      { confidence: "not_at_all", stopAfter: 1, nextDueOn: "2026-09-25", gapDays: 1 },
    ]);
  });

  it("gives the same answer on the buttons as the rating itself", () => {
    for (const option of ratingOptions(4, ladder, THU_24_SEP)) {
      const review = rated({
        item: { stop: 4, dueOn: "2026-09-21" },
        confidence: option.confidence,
      });
      expect(itemAfter(review)).toEqual({ stop: option.stopAfter, dueOn: option.nextDueOn });
    }
  });
});

describe("Manual date: picking a date replaces only the date", () => {
  const stop4 = { stop: 4, dueOn: THU_24_SEP };

  it("uses the picked date and still moves the ladder", () => {
    const review = rated({ item: stop4, confidence: "confident", pickedDate: "2026-10-10" });
    expect(itemAfter(review)).toEqual({ stop: 5, dueOn: "2026-10-10" });
  });

  it("records that the date was picked", () => {
    expect(rated({ item: stop4, confidence: "neutral", pickedDate: "2026-09-30" }).manual).toBe(
      true,
    );
    expect(rated({ item: stop4, confidence: "neutral" }).manual).toBe(false);
  });

  it("accepts tomorrow, the first date after today", () => {
    const review = rated({ item: stop4, confidence: "neutral", pickedDate: "2026-09-25" });
    expect(review.nextDueOn).toBe("2026-09-25");
  });

  it("refuses today", () => {
    expect(
      rate({
        item: stop4,
        ladder,
        today: THU_24_SEP,
        confidence: "neutral",
        reviewedToday: false,
        pickedDate: THU_24_SEP,
      }),
    ).toEqual({ ok: false, error: "picked-date-not-after-today" });
  });

  it("refuses a date in the past", () => {
    expect(
      rate({
        item: stop4,
        ladder,
        today: THU_24_SEP,
        confidence: "neutral",
        reviewedToday: false,
        pickedDate: "2026-09-01",
      }),
    ).toEqual({ ok: false, error: "picked-date-not-after-today" });
  });

  it("refuses something that isn't a date", () => {
    expect(
      rate({
        item: stop4,
        ladder,
        today: THU_24_SEP,
        confidence: "neutral",
        reviewedToday: false,
        pickedDate: "2026-02-30",
      }),
    ).toEqual({ ok: false, error: "picked-date-invalid" });
  });
});

describe("Late and early reviews: the next date counts from the day you actually review", () => {
  it("counts a late review from the review day, not the missed due date", () => {
    // Due Mon 21 Sep, reviewed Thu 24 Sep: Confident from stop 4 → 24 Sep + 7 days.
    const review = rated({ item: { stop: 4, dueOn: "2026-09-21" }, confidence: "confident" });
    expect(review.nextDueOn).toBe("2026-10-01");
    expect(reviewTiming(review)).toEqual({ kind: "late", days: 3 });
  });

  it("counts an early review from the review day too, and it works like any other", () => {
    // Due Fri 25 Sep, reviewed early on Thu 24 Sep.
    const review = rated({ item: { stop: 1, dueOn: "2026-09-25" }, confidence: "confident" });
    expect(itemAfter(review)).toEqual({ stop: 2, dueOn: "2026-09-26" });
    expect(reviewTiming(review)).toEqual({ kind: "early", days: 1 });
  });

  it("remembers the due date the item had, for Undo and the history marks", () => {
    const review = rated({ item: { stop: 4, dueOn: "2026-09-21" }, confidence: "neutral" });
    expect(review).toMatchObject({ reviewedOn: THU_24_SEP, wasDueOn: "2026-09-21", stopBefore: 4 });
  });
});

describe("The Dijkstra item's history, 3 Sep to 16 Sep (page 18)", () => {
  // Each row: the day it was reviewed, the rating, and the date picked, if any.
  const steps: { on: string; confidence: Confidence; picked?: string }[] = [
    { on: "2026-09-03", confidence: "neutral" },
    { on: "2026-09-04", confidence: "confident", picked: "2026-09-07" },
    { on: "2026-09-07", confidence: "confident" },
    { on: "2026-09-10", confidence: "not_at_all" },
    { on: "2026-09-11", confidence: "confident" },
    { on: "2026-09-12", confidence: "confident" },
    { on: "2026-09-16", confidence: "confident" },
  ];

  function replay() {
    let item = newItemSchedule("2026-09-03");
    const reviews: Review[] = [];
    for (const step of steps) {
      const result = rate({
        item,
        ladder,
        today: step.on,
        confidence: step.confidence,
        pickedDate: step.picked,
        reviewedToday: false,
      });
      if (!result.ok) throw new Error(`refused on ${step.on}: ${result.error}`);
      reviews.push(result.value);
      item = itemAfter(result.value);
    }
    return { item, reviews };
  }

  it("matches every row of the history table", () => {
    const rows = replay().reviews.map((r) => [r.reviewedOn, r.stopAfter, r.nextDueOn, r.manual]);
    expect(rows).toEqual([
      ["2026-09-03", 1, "2026-09-04", false], // Thu 3 Sep · Neutral → Fri 4 Sep
      ["2026-09-04", 2, "2026-09-07", true], // Fri 4 Sep · Confident → Mon 7 Sep, picked
      ["2026-09-07", 3, "2026-09-10", false], // Mon 7 Sep · Confident → Thu 10 Sep
      ["2026-09-10", 1, "2026-09-11", false], // Thu 10 Sep · Not at all → Fri 11 Sep
      ["2026-09-11", 2, "2026-09-13", false], // Fri 11 Sep · Confident → Sun 13 Sep
      ["2026-09-12", 3, "2026-09-15", false], // Sat 12 Sep · Confident → Tue 15 Sep
      ["2026-09-16", 4, "2026-09-21", false], // Wed 16 Sep · Confident → Mon 21 Sep
    ]);
  });

  it("marks the review on Sat 12 Sep as 1 day early and Wed 16 Sep as 1 day late", () => {
    const timings = replay().reviews.map((r) => reviewTiming(r).kind);
    expect(timings).toEqual([
      "on-time",
      "on-time",
      "on-time",
      "on-time",
      "on-time",
      "early",
      "late",
    ]);
    expect(reviewTiming(replay().reviews[5]!)).toEqual({ kind: "early", days: 1 });
  });

  it("leaves the item on stop 4, due Mon 21 Sep: +3 days on Thu 24 Sep (page 01)", () => {
    const { item } = replay();
    expect(item).toEqual({ stop: 4, dueOn: "2026-09-21" });
    expect(daysLate(item.dueOn, THU_24_SEP)).toBe(3);
  });
});

describe("Once a day: an item can be reviewed at most once per day", () => {
  const item = { stop: 2, dueOn: THU_24_SEP };

  it("refuses a second review on the same day", () => {
    expect(
      rate({ item, ladder, today: THU_24_SEP, confidence: "confident", reviewedToday: true }),
    ).toEqual({ ok: false, error: "already-reviewed-today" });
  });

  it("allows the item again the next day", () => {
    const first = rated({ item, confidence: "not_at_all" });
    const next = rate({
      item: itemAfter(first),
      ladder,
      today: "2026-09-25",
      confidence: "confident",
      reviewedToday: false,
    });
    expect(next.ok).toBe(true);
  });

  it("allows a new rating today once Undo has removed the first one", () => {
    const first = rated({ item, confidence: "not_at_all" });
    const restored = undo(first, THU_24_SEP);
    if (!restored.ok) throw new Error("undo refused");
    const again = rated({ item: restored.value, confidence: "confident" });
    expect(itemAfter(again)).toEqual({ stop: 3, dueOn: "2026-09-27" });
  });
});

describe("Undo puts back the stop and due date the item had", () => {
  it("restores stop_before and was_due_on", () => {
    const review = rated({ item: { stop: 4, dueOn: "2026-09-21" }, confidence: "not_at_all" });
    expect(undo(review, THU_24_SEP)).toEqual({ ok: true, value: { stop: 4, dueOn: "2026-09-21" } });
  });

  it("restores a picked date's item too", () => {
    const review = rated({
      item: { stop: 2, dueOn: THU_24_SEP },
      confidence: "confident",
      pickedDate: "2026-12-01",
    });
    expect(undo(review, THU_24_SEP)).toEqual({ ok: true, value: { stop: 2, dueOn: THU_24_SEP } });
  });

  it("only undoes a review made today", () => {
    const review = rated({ item: { stop: 4, dueOn: THU_24_SEP }, confidence: "confident" });
    expect(undo(review, "2026-09-25")).toEqual({ ok: false, error: "not-from-today" });
  });
});

describe("Ladder edits apply from each item's next review", () => {
  it("keeps the due date already set, and uses the new gap at the next review", () => {
    const item = { stop: 4, dueOn: "2026-09-29" };
    const edited = setGap(DEFAULT_LADDER, 4, 6);
    // Nothing reschedules the item when the gap changes; its due date stays 29 Sep.
    const review = rated({ item, ladder: edited, today: "2026-09-29", confidence: "neutral" });
    expect(review.wasDueOn).toBe("2026-09-29");
    expect(itemAfter(review)).toEqual({ stop: 4, dueOn: "2026-10-05" });
  });

  it("rates an item moved by a stop removal from its new stop, on the new ladder", () => {
    const removed = removeStop(DEFAULT_LADDER, 3);
    if (!removed.ok) throw new Error("removal refused");
    const item = { stop: stopAfterRemoval(3, 3), dueOn: THU_24_SEP };
    expect(item.stop).toBe(2);
    expect(itemAfter(rated({ item, ladder: removed.value, confidence: "confident" }))).toEqual({
      stop: 3,
      dueOn: "2026-09-29", // the new stop 3 is the old stop 4: 5 days
    });
  });
});

describe("New items", () => {
  it("start on stop 1 and are due the day they're added", () => {
    expect(newItemSchedule(THU_24_SEP)).toEqual({ stop: 1, dueOn: THU_24_SEP });
  });

  it("can be reviewed the day they're added", () => {
    const review = rated({ item: newItemSchedule(THU_24_SEP), confidence: "confident" });
    expect(itemAfter(review)).toEqual({ stop: 2, dueOn: "2026-09-26" });
    expect(reviewTiming(review)).toEqual({ kind: "on-time" });
  });
});
