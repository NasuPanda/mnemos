import { describe, expect, it } from "vitest";
import { todayCounts } from "../../src/core";
import type { TodayResponse } from "../contract";
import { addImage, addItem, addReview, addSection } from "../test/fixtures";
import { signIn } from "../test/session";

const TODAY = "2026-09-24";

async function today(email: string) {
  const session = await signIn(email);
  const get = async (date = TODAY) => {
    const res = await session.get(`/api/today?date=${date}`);
    return { status: res.status, body: (await res.json()) as TodayResponse };
  };
  return { ...session, today: get };
}

describe("GET /api/today", () => {
  it("needs today's date from the browser as YYYY-MM-DD", async () => {
    const session = await signIn("tara@example.com");
    expect((await session.get("/api/today")).status).toBe(400);
    expect((await session.get("/api/today?date=24/09/2026")).status).toBe(400);
    expect((await session.get("/api/today?date=2026-02-30")).status).toBe(400);
  });

  it("returns the person's ladder and their sections in their own order", async () => {
    const s = await today("uma@example.com");
    await addSection(s.userId, { code: "DS", line: "m3", position: 2 });
    await addSection(s.userId, { code: "GR", line: "m2", position: 1 });

    const { status, body } = await s.today();
    expect(status).toBe(200);
    expect(body.ladder).toEqual([1, 2, 3, 5, 7, 14, 28]);
    expect(body.sections.map((section) => [section.code, section.line])).toEqual([
      ["GR", "m2"],
      ["DS", "m3"],
    ]);
  });

  it("lists the items left today: due today or earlier, not later", async () => {
    const s = await today("vic@example.com");
    const section = await addSection(s.userId, { code: "GR" });
    const late = await addItem(s.userId, section, { name: "Late", dueOn: "2026-09-21", stop: 4 });
    const due = await addItem(s.userId, section, { name: "Due today", dueOn: TODAY });
    await addItem(s.userId, section, { name: "Tomorrow", dueOn: "2026-09-25" });

    const { body } = await s.today();
    expect(body.items.map((item) => item.id)).toEqual([late, due]);
    expect(body.items[0]).toMatchObject({ name: "Late", stop: 4, dueOn: "2026-09-21" });
  });

  it("leaves out items already reviewed today", async () => {
    const s = await today("wes@example.com");
    const section = await addSection(s.userId, { code: "GR" });
    const reviewed = await addItem(s.userId, section, { name: "Reviewed", dueOn: TODAY });
    await addReview(s.userId, reviewed, { reviewedOn: TODAY, nextDueOn: "2026-09-26" });

    const { body } = await s.today();
    expect(body.items).toEqual([]);
    expect(body.reviewsToday.map((review) => review.itemId)).toEqual([reviewed]);
  });

  it("includes each item's content and images, problem side first, in position order", async () => {
    const s = await today("xia@example.com");
    const section = await addSection(s.userId, { code: "GR" });
    const item = await addItem(s.userId, section, {
      name: "With images",
      dueOn: TODAY,
      answerText: "Because **negative** edges.",
    });
    await addImage(item, { key: "c.webp", side: "answer", position: 1 });
    await addImage(item, { key: "b.webp", side: "problem", position: 2 });
    await addImage(item, { key: "a.webp", side: "problem", position: 1 });

    const { body } = await s.today();
    expect(body.items[0]?.answerText).toBe("Because **negative** edges.");
    expect(body.items[0]?.images).toEqual([
      { key: "a.webp", side: "problem", position: 1 },
      { key: "b.webp", side: "problem", position: 2 },
      { key: "c.webp", side: "answer", position: 1 },
    ]);
  });

  it("returns today's reviews (Done) and tomorrow's due items (for All done)", async () => {
    const s = await today("yan@example.com");
    const section = await addSection(s.userId, { code: "GR" });
    const early = await addItem(s.userId, section, { name: "Reviewed early", dueOn: "2026-09-25" });
    const tomorrow = await addItem(s.userId, section, { name: "Tomorrow", dueOn: "2026-09-25" });
    await addReview(s.userId, early, { reviewedOn: TODAY, nextDueOn: "2026-09-25" });
    await addReview(s.userId, tomorrow, { reviewedOn: "2026-09-23", nextDueOn: "2026-09-25" });

    const { body } = await s.today();
    expect(body.reviewsToday).toHaveLength(1);
    expect(body.reviewsToday[0]).toMatchObject({ itemId: early, reviewedOn: TODAY });
    expect(body.tomorrow).toEqual({ date: "2026-09-25", itemIds: [early, tomorrow] });
  });

  it("gives the app what it needs to count Left, Late and Done with src/core", async () => {
    const s = await today("zoe@example.com");
    const section = await addSection(s.userId, { code: "GR" });
    await addItem(s.userId, section, { name: "Late", dueOn: "2026-09-22" });
    await addItem(s.userId, section, { name: "Due", dueOn: TODAY });
    const done = await addItem(s.userId, section, { name: "Done", dueOn: TODAY });
    await addReview(s.userId, done, { reviewedOn: TODAY, nextDueOn: "2026-09-26" });

    const { body } = await s.today();
    expect(todayCounts(body.items, body.reviewsToday, TODAY)).toEqual({
      left: 2,
      late: 1,
      done: 1,
    });
  });

  it("never shows another person's sections, items or reviews", async () => {
    const owner = await today("ana@example.com");
    const section = await addSection(owner.userId, { code: "GR" });
    const item = await addItem(owner.userId, section, { name: "Private", dueOn: TODAY });
    await addReview(owner.userId, item, { reviewedOn: TODAY, nextDueOn: "2026-09-25" });

    const stranger = await today("bo@example.com");
    const { body } = await stranger.today();
    expect(body.sections).toEqual([]);
    expect(body.items).toEqual([]);
    expect(body.reviewsToday).toEqual([]);
  });
});
