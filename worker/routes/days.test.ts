import { describe, expect, it } from "vitest";
import { futureDayCounts, stripCount } from "../../src/core";
import type { DayResponse } from "../contract";
import { addImage, addItem, addReview, addSection } from "../test/fixtures";
import { signIn } from "../test/session";

// The design draft's week: Mon 21 to Sun 27 September 2026, seen on Thursday the 24th.
const TODAY = "2026-09-24";
const FRIDAY = "2026-09-25";
const MONDAY = "2026-09-21";
const WEEK = [MONDAY, "2026-09-22", "2026-09-23", TODAY, FRIDAY, "2026-09-26", "2026-09-27"];

async function person(email: string) {
  const session = await signIn(email);
  const day = async (date: string, today = TODAY) => {
    const res = await session.get(`/api/days/${date}?today=${today}`);
    return { status: res.status, body: (await res.json()) as DayResponse };
  };
  return { ...session, day };
}

describe("GET /api/days/:date", () => {
  it("needs the day and the browser's today as YYYY-MM-DD", async () => {
    const s = await signIn("cal@example.com");
    expect((await s.get(`/api/days/${FRIDAY}`)).status).toBe(400);
    expect((await s.get(`/api/days/25-09-2026?today=${TODAY}`)).status).toBe(400);
    expect((await s.get(`/api/days/${FRIDAY}?today=2026-02-30`)).status).toBe(400);
  });

  it("gives the week strip Monday to Sunday of the day's week", async () => {
    const s = await person("dee@example.com");
    expect((await s.day(FRIDAY)).body.week.days).toEqual(WEEK);
    expect((await s.day("2026-09-27")).body.week.days).toEqual(WEEK);
    expect((await s.day("2026-09-28")).body.week.days[0]).toBe("2026-09-28");
  });

  it("counts a future day's items due, including ones already reviewed today", async () => {
    const s = await person("eli@example.com");
    const section = await addSection(s.userId, { code: "GR" });
    const due = await addItem(s.userId, section, { name: "Due Friday", dueOn: FRIDAY });
    const reviewed = await addItem(s.userId, section, {
      name: "Reviewed, back Friday",
      dueOn: FRIDAY,
    });
    await addReview(s.userId, reviewed, { reviewedOn: TODAY, nextDueOn: FRIDAY, wasDueOn: TODAY });
    const sunday = await addItem(s.userId, section, { name: "Sunday", dueOn: "2026-09-27" });
    await addItem(s.userId, section, { name: "Next week", dueOn: "2026-09-28" });
    await addItem(s.userId, section, { name: "Today", dueOn: TODAY });
    await addItem(s.userId, section, { name: "Late", dueOn: "2026-09-22" });

    const { status, body } = await s.day(FRIDAY);
    expect(status).toBe(200);
    expect(body.week.due).toEqual([
      { id: due, dueOn: FRIDAY },
      { id: reviewed, dueOn: FRIDAY },
      { id: sunday, dueOn: "2026-09-27" },
    ]);
    const strip = { items: body.week.due, reviews: body.week.reviews };
    expect(stripCount(FRIDAY, TODAY, { ...strip, items: strip.items.map(withSection) })).toEqual({
      kind: "future",
      due: 2,
    });
  });

  it("counts a past day's reviews done; missed items don't count there", async () => {
    const s = await person("fay@example.com");
    const section = await addSection(s.userId, { code: "GR" });
    const a = await addItem(s.userId, section, { name: "A", dueOn: "2026-09-30" });
    const b = await addItem(s.userId, section, { name: "B", dueOn: "2026-09-30" });
    await addItem(s.userId, section, { name: "Missed on Monday", dueOn: MONDAY });
    await addReview(s.userId, a, { reviewedOn: MONDAY, nextDueOn: "2026-09-22" });
    await addReview(s.userId, b, { reviewedOn: MONDAY, nextDueOn: "2026-09-23" });
    await addReview(s.userId, a, { reviewedOn: "2026-09-22", nextDueOn: "2026-09-30" });
    await addReview(s.userId, b, { reviewedOn: "2026-09-20", nextDueOn: MONDAY });
    await addReview(s.userId, b, { reviewedOn: TODAY, nextDueOn: "2026-09-30" });

    const { body } = await s.day(MONDAY);
    expect(body.week.reviews).toEqual([
      { itemId: a, reviewedOn: MONDAY },
      { itemId: b, reviewedOn: MONDAY },
      { itemId: a, reviewedOn: "2026-09-22" },
    ]);
    const strip = { items: body.week.due.map(withSection), reviews: body.week.reviews };
    expect(stripCount(MONDAY, TODAY, strip)).toEqual({ kind: "past", done: 2 });
    expect(stripCount("2026-09-23", TODAY, strip)).toEqual({ kind: "past", done: 0 });
  });

  it("gives a future day's items with their content and images, for Review early", async () => {
    const s = await person("gus@example.com");
    const section = await addSection(s.userId, { code: "GR" });
    const item = await addItem(s.userId, section, {
      name: "Dijkstra with a binary heap",
      dueOn: FRIDAY,
      stop: 5,
      answerText: "Decrease-key, or push again.",
    });
    await addImage(item, { key: "b.webp", side: "answer", position: 1 });
    await addImage(item, { key: "a.webp", side: "problem", position: 1 });
    await addItem(s.userId, section, { name: "Saturday", dueOn: "2026-09-26" });

    const { body } = await s.day(FRIDAY);
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({
      id: item,
      name: "Dijkstra with a binary heap",
      stop: 5,
      dueOn: FRIDAY,
      answerText: "Decrease-key, or push again.",
      images: [
        { key: "a.webp", side: "problem", position: 1 },
        { key: "b.webp", side: "answer", position: 1 },
      ],
    });
    expect(body.reviews).toEqual([]);
  });

  it("lets the app count Due and Early with src/core: 17 due − 5 reviewed today (page 10)", async () => {
    const s = await person("hal@example.com");
    const section = await addSection(s.userId, { code: "GR" });
    for (let n = 0; n < 17; n++) {
      const item = await addItem(s.userId, section, { name: `Friday ${n}`, dueOn: FRIDAY });
      if (n < 5) await addReview(s.userId, item, { reviewedOn: TODAY, nextDueOn: FRIDAY });
    }
    const reviewedToday = new Set(
      (
        await s
          .get(`/api/today?date=${TODAY}`)
          .then((res) => res.json() as Promise<{ reviewsToday: { itemId: number }[] }>)
      ).reviewsToday.map((review) => review.itemId),
    );

    const { body } = await s.day(FRIDAY);
    expect(futureDayCounts(body.items, reviewedToday, FRIDAY, TODAY)).toEqual({
      due: 17,
      reviewedToday: 5,
      early: 12,
    });
  });

  it("gives a past day's reviews with each item's name and section, in the order made", async () => {
    const s = await person("ida@example.com");
    const graphs = await addSection(s.userId, { code: "GR" });
    const os = await addSection(s.userId, { code: "OS", position: 2 });
    const first = await addItem(s.userId, os, { name: "Mutex vs semaphore", dueOn: "2026-10-01" });
    const second = await addItem(s.userId, graphs, { name: "Bellman–Ford", dueOn: "2026-09-26" });
    const early = await addReview(s.userId, first, {
      reviewedOn: MONDAY,
      wasDueOn: "2026-09-22",
      nextDueOn: "2026-10-01",
      confidence: "neutral",
      stopBefore: 3,
      stopAfter: 3,
      manual: true,
    });
    const later = await addReview(s.userId, second, {
      reviewedOn: MONDAY,
      nextDueOn: "2026-09-26",
    });

    const { body } = await s.day(MONDAY);
    expect(body.items).toEqual([]);
    expect(body.reviews).toEqual([
      {
        id: early,
        itemId: first,
        reviewedOn: MONDAY,
        confidence: "neutral",
        stopBefore: 3,
        stopAfter: 3,
        wasDueOn: "2026-09-22",
        nextDueOn: "2026-10-01",
        manual: true,
        name: "Mutex vs semaphore",
        sectionId: os,
      },
      expect.objectContaining({
        id: later,
        itemId: second,
        name: "Bellman–Ford",
        sectionId: graphs,
      }),
    ]);
  });

  it("gives today only the week strip: today itself comes from /api/today", async () => {
    const s = await person("jo@example.com");
    const section = await addSection(s.userId, { code: "GR" });
    // Rated today, so it moved on to Friday.
    const item = await addItem(s.userId, section, { name: "Rated today", dueOn: FRIDAY });
    await addReview(s.userId, item, { reviewedOn: TODAY, wasDueOn: TODAY, nextDueOn: FRIDAY });

    const { body } = await s.day(TODAY);
    expect(body.items).toEqual([]);
    expect(body.reviews).toEqual([]);
    expect(body.week.due).toEqual([{ id: item, dueOn: FRIDAY }]);
    expect(body.week.reviews).toEqual([]);
  });

  it("sees a whole past or future week by the browser's today, not the server's", async () => {
    const s = await person("kai@example.com");
    const section = await addSection(s.userId, { code: "GR" });
    const item = await addItem(s.userId, section, { name: "Friday", dueOn: FRIDAY });
    await addReview(s.userId, item, { reviewedOn: MONDAY, nextDueOn: FRIDAY });

    // A week later, Friday 25 is in the past: no items due there, only reviews.
    const later = await s.day(FRIDAY, "2026-10-01");
    expect(later.body.items).toEqual([]);
    expect(later.body.week.due).toEqual([]);
    expect(later.body.week.reviews).toEqual([{ itemId: item, reviewedOn: MONDAY }]);

    // A week earlier, the whole week is ahead: no reviews yet, only items due.
    const earlier = await s.day(FRIDAY, "2026-09-17");
    expect(earlier.body.week.reviews).toEqual([]);
    expect(earlier.body.items.map((i) => i.id)).toEqual([item]);
  });

  it("never shows another person's items or reviews", async () => {
    const owner = await person("lou@example.com");
    const section = await addSection(owner.userId, { code: "GR" });
    const item = await addItem(owner.userId, section, { name: "Private", dueOn: FRIDAY });
    await addReview(owner.userId, item, { reviewedOn: MONDAY, nextDueOn: FRIDAY });

    const stranger = await person("max@example.com");
    for (const date of [MONDAY, TODAY, FRIDAY]) {
      const { body } = await stranger.day(date);
      expect(body.items).toEqual([]);
      expect(body.reviews).toEqual([]);
      expect(body.week.due).toEqual([]);
      expect(body.week.reviews).toEqual([]);
    }
  });
});

/** stripCount only needs each item's due date; the section doesn't matter for counting. */
function withSection(item: { id: number; dueOn: string }) {
  return { ...item, sectionId: 0 };
}
