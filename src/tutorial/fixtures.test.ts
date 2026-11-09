import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addDays, rate, reviewQueue, todayCounts, type IsoDate } from "@/core";
import {
  makeSandbox,
  PRACTICE_ITEM,
  PRACTICE_LINE,
  SAMPLE_IMAGES,
  SORTED_ARRAY_KEY,
} from "./fixtures";
import { createSandboxApi } from "./sandbox-api";

beforeEach(() => {
  vi.stubGlobal("fetch", () => {
    throw new Error("the practice day reached the network");
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// An ordinary Monday, the first of a month, New Year's Day, and a leap day.
const TODAYS: IsoDate[] = ["2026-11-09", "2026-03-01", "2027-01-01", "2028-02-29"];

describe.each(TODAYS)("the practice day starting %s", (today) => {
  const practice = () => createSandboxApi(makeSandbox(today), SAMPLE_IMAGES);

  it("has 3 left, 1 of them late, on two lines: HU (M2) and AL (M3)", async () => {
    const day = await practice().today(today);
    expect(todayCounts(day.items, day.reviewsToday, today)).toEqual({ left: 3, late: 1, done: 0 });
    expect(day.sections.map((s) => [s.code, s.name, s.line])).toEqual([
      ["HU", "Hungarian words", "m2"],
      ["AL", "Algorithms", "m3"],
    ]);
    expect(day.nextLine).toBe("m4");
    expect(day.ladder).toEqual([1, 2, 3, 5, 7, 14, 28]);
  });

  it("puts villamos, 2 days late on stop 4, first in the run", async () => {
    const day = await practice().today(today);
    const run = reviewQueue(day.items, { sections: day.sections, reviewedToday: new Set(), today });
    expect(run.map((i) => [i.name, i.stop, i.dueOn])).toEqual([
      ["villamos", 4, addDays(today, -2)],
      ["köszönöm", 2, today],
      ["Binary search on 1,000 items", 3, today],
    ]);
  });

  it("gives villamos's buttons three different dates: 7 days, 5 days and tomorrow", async () => {
    const [villamos] = (await practice().today(today)).items;
    const button = (confidence: "confident" | "neutral" | "not_at_all") => {
      const result = rate({
        item: villamos!,
        ladder: [1, 2, 3, 5, 7, 14, 28],
        today,
        confidence,
        reviewedToday: false,
      });
      return result.ok ? [result.value.stopAfter, result.value.nextDueOn] : result.error;
    };
    expect(button("confident")).toEqual([5, addDays(today, 7)]);
    expect(button("neutral")).toEqual([4, addDays(today, 5)]);
    expect(button("not_at_all")).toEqual([1, addDays(today, 1)]);
  });

  it("has the histories that put each item where it is", async () => {
    const api = practice();
    const history = async (itemId: number) =>
      (await api.itemHistory(itemId)).reviews.map((r) => [r.reviewedOn, r.stopBefore, r.stopAfter]);
    expect(await history(1)).toEqual([
      [addDays(today, -7), 3, 4],
      [addDays(today, -10), 2, 3],
      [addDays(today, -12), 1, 2],
    ]);
    expect(await history(2)).toEqual([[addDays(today, -2), 1, 2]]);
    expect(await history(3)).toEqual([
      [addDays(today, -3), 2, 3],
      [addDays(today, -5), 1, 2],
    ]);
  });

  it("shows those reviews on the past days of this week", async () => {
    const api = practice();
    const day = await api.day(today, today);
    for (const { reviewedOn } of day.week.reviews) {
      expect(reviewedOn < today).toBe(true);
    }
    const twoDaysAgo = await api.day(addDays(today, -2), today);
    expect(twoDaysAgo.reviews.map((r) => r.name)).toEqual(["köszönöm"]);
  });

  it("gives Binary search its image and a python code block", async () => {
    const api = practice();
    const { item } = await api.item(3);
    expect(item.images).toEqual([{ key: SORTED_ARRAY_KEY, side: "problem", position: 1 }]);
    expect(api.imageUrl(SORTED_ARRAY_KEY)).toBe("/tutorial/sorted-array.webp");
    expect(item.answerText).toContain("```python");
  });

  it("makes a run of 4 on 2 lines, 1 late, once the practice item is saved", async () => {
    const api = practice();
    const hu = (await api.today(today)).sections.find((s) => s.code === PRACTICE_LINE)!;
    const { item } = await api.createItem({ ...PRACTICE_ITEM, sectionId: hu.id, date: today });
    expect(item).toMatchObject({ name: "Egészségedre!", sectionId: hu.id, stop: 1, dueOn: today });

    const day = await api.today(today);
    const run = reviewQueue(day.items, { sections: day.sections, reviewedToday: new Set(), today });
    expect(run.map((i) => i.name)).toEqual([
      "villamos",
      "köszönöm",
      "Egészségedre!",
      "Binary search on 1,000 items",
    ]);
    expect(new Set(run.map((i) => i.sectionId)).size).toBe(2);
    expect(todayCounts(day.items, day.reviewsToday, today).late).toBe(1);
  });
});
