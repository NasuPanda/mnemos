import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { RateResponse, TodayResponse, UndoResponse } from "../contract";
import { getDb } from "../db/client";
import { saveReview } from "../db/reviews";
import { addItem, addReview, addSection, itemState } from "../test/fixtures";
import { signIn, type Session } from "../test/session";

const TODAY = "2026-09-24";

async function withItem(email: string, item: { stop?: number; dueOn?: string } = {}) {
  const session = await signIn(email);
  const section = await addSection(session.userId, { code: "GR" });
  const itemId = await addItem(session.userId, section, {
    name: "Why Dijkstra fails on negative edges",
    stop: item.stop ?? 4,
    dueOn: item.dueOn ?? "2026-09-21",
  });
  return { session, itemId };
}

const rateItem = (session: Session, body: Record<string, unknown>) =>
  session.post("/api/reviews", { date: TODAY, confidence: "confident", ...body });

describe("POST /api/reviews: rating an item", () => {
  it("moves a stop-4 item rated Confident on Thu 24 Sep to stop 5, due Thu 1 Oct", async () => {
    const { session, itemId } = await withItem("ada@example.com");
    const res = await rateItem(session, { itemId });

    expect(res.status).toBe(201);
    const body = (await res.json()) as RateResponse;
    expect(body.item).toEqual({ id: itemId, stop: 5, dueOn: "2026-10-01" });
    expect(body.review).toMatchObject({
      itemId,
      reviewedOn: TODAY,
      confidence: "confident",
      stopBefore: 4,
      stopAfter: 5,
      wasDueOn: "2026-09-21",
      nextDueOn: "2026-10-01",
      manual: false,
    });
    expect(await itemState(itemId)).toEqual({ stop: 5, dueOn: "2026-10-01" });
  });

  it("takes it off today's list once rated", async () => {
    const { session, itemId } = await withItem("ben@example.com");
    await rateItem(session, { itemId, confidence: "not_at_all" });
    const today = (await (await session.get(`/api/today?date=${TODAY}`)).json()) as TodayResponse;
    expect(today.items).toEqual([]);
    expect(today.reviewsToday.map((review) => review.itemId)).toEqual([itemId]);
  });

  it("uses a picked date instead of the gap, still moves the ladder, and records it", async () => {
    const { session, itemId } = await withItem("cy@example.com");
    const res = await rateItem(session, {
      itemId,
      confidence: "neutral",
      pickedDate: "2026-10-05",
    });
    const body = (await res.json()) as RateResponse;
    expect(body.item).toEqual({ id: itemId, stop: 4, dueOn: "2026-10-05" });
    expect(body.review.manual).toBe(true);
  });

  it("refuses a picked date that isn't after today, and changes nothing", async () => {
    const { session, itemId } = await withItem("dee@example.com");
    for (const pickedDate of [TODAY, "2026-09-01"]) {
      const res = await rateItem(session, { itemId, pickedDate });
      expect(res.status).toBe(422);
      expect(await res.json()).toEqual({ error: "picked-date-not-after-today" });
    }
    expect((await rateItem(session, { itemId, pickedDate: "2026-02-30" })).status).toBe(422);
    expect(await itemState(itemId)).toEqual({ stop: 4, dueOn: "2026-09-21" });
  });

  it("allows one review per item per day", async () => {
    const { session, itemId } = await withItem("eli@example.com");
    expect((await rateItem(session, { itemId })).status).toBe(201);
    const second = await rateItem(session, { itemId, confidence: "not_at_all" });
    expect(second.status).toBe(409);
    expect(await itemState(itemId)).toEqual({ stop: 5, dueOn: "2026-10-01" });
  });

  it("rates an item early, counting from today", async () => {
    const { session, itemId } = await withItem("fay@example.com", { stop: 1, dueOn: "2026-09-25" });
    const body = (await (await rateItem(session, { itemId })).json()) as RateResponse;
    expect(body.item).toEqual({ id: itemId, stop: 2, dueOn: "2026-09-26" });
    expect(body.review.wasDueOn).toBe("2026-09-25");
  });

  it("uses the person's own ladder", async () => {
    const { session, itemId } = await withItem("gus@example.com", { stop: 2 });
    await env.DB.prepare("UPDATE settings SET ladder_days = '[1,4,9]' WHERE user_id = ?")
      .bind(session.userId)
      .run();
    const body = (await (await rateItem(session, { itemId })).json()) as RateResponse;
    expect(body.item).toEqual({ id: itemId, stop: 3, dueOn: "2026-10-03" });
  });

  it("won't rate another person's item, or one that doesn't exist", async () => {
    const { itemId } = await withItem("hal@example.com");
    const stranger = await signIn("ivy@example.com");
    expect((await rateItem(stranger, { itemId })).status).toBe(404);
    expect((await rateItem(stranger, { itemId: 999_999 })).status).toBe(404);
    expect(await itemState(itemId)).toEqual({ stop: 4, dueOn: "2026-09-21" });
  });

  it("refuses incomplete or malformed requests", async () => {
    const { session, itemId } = await withItem("joy@example.com");
    for (const body of [
      { itemId, confidence: undefined },
      { itemId, confidence: "great" },
      { itemId, date: "24/09/2026" },
      { itemId: "1" },
      { itemId: -1 },
      { itemId, pickedDate: 20261005 },
    ]) {
      expect((await rateItem(session, body)).status, JSON.stringify(body)).toBe(400);
    }
    const res = await session.post("/api/reviews", "not json");
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/reviews/:id: Undo", () => {
  async function rated(email: string) {
    const { session, itemId } = await withItem(email);
    const body = (await (await rateItem(session, { itemId })).json()) as RateResponse;
    return { session, itemId, reviewId: body.review.id };
  }

  it("puts back the stop and due date the item had, and deletes the review", async () => {
    const { session, itemId, reviewId } = await rated("kim@example.com");
    const res = await session.del(`/api/reviews/${reviewId}?date=${TODAY}`);

    expect(res.status).toBe(200);
    expect((await res.json()) as UndoResponse).toEqual({
      item: { id: itemId, stop: 4, dueOn: "2026-09-21" },
    });
    expect(await itemState(itemId)).toEqual({ stop: 4, dueOn: "2026-09-21" });
    const left = await env.DB.prepare("SELECT id FROM reviews WHERE id = ?").bind(reviewId).first();
    expect(left).toBeNull();
  });

  it("lets the item be rated again today", async () => {
    const { session, itemId, reviewId } = await rated("lou@example.com");
    await session.del(`/api/reviews/${reviewId}?date=${TODAY}`);
    const again = await rateItem(session, { itemId, confidence: "not_at_all" });
    expect(again.status).toBe(201);
    expect(await itemState(itemId)).toEqual({ stop: 1, dueOn: "2026-09-25" });
  });

  it("only undoes a review made today", async () => {
    const { session, itemId, reviewId } = await rated("mia@example.com");
    const res = await session.del(`/api/reviews/${reviewId}?date=2026-09-25`);
    expect(res.status).toBe(409);
    expect(await itemState(itemId)).toEqual({ stop: 5, dueOn: "2026-10-01" });
  });

  it("won't undo if the item has moved since the rating, and keeps the review", async () => {
    const { session, itemId, reviewId } = await rated("ned@example.com");
    await env.DB.prepare("UPDATE items SET stop = 6 WHERE id = ?").bind(itemId).run();
    const res = await session.del(`/api/reviews/${reviewId}?date=${TODAY}`);
    expect(res.status).toBe(409);
    expect(await itemState(itemId)).toEqual({ stop: 6, dueOn: "2026-10-01" });
    const kept = await env.DB.prepare("SELECT id FROM reviews WHERE id = ?").bind(reviewId).first();
    expect(kept).not.toBeNull();
  });

  it("won't undo another person's review", async () => {
    const { itemId, reviewId } = await rated("ola@example.com");
    const stranger = await signIn("pat@example.com");
    expect((await stranger.del(`/api/reviews/${reviewId}?date=${TODAY}`)).status).toBe(404);
    expect(await itemState(itemId)).toEqual({ stop: 5, dueOn: "2026-10-01" });
  });

  it("refuses a request without a valid id and date", async () => {
    const session = await signIn("ray@example.com");
    expect((await session.del(`/api/reviews/abc?date=${TODAY}`)).status).toBe(400);
    expect((await session.del("/api/reviews/1")).status).toBe(400);
  });

  it("restores an item reviewed earlier today by another device too", async () => {
    const session = await signIn("sky@example.com");
    const section = await addSection(session.userId, { code: "GR" });
    const itemId = await addItem(session.userId, section, {
      name: "Item",
      stop: 2,
      dueOn: "2026-09-26",
    });
    const reviewId = await addReview(session.userId, itemId, {
      reviewedOn: TODAY,
      stopBefore: 1,
      stopAfter: 2,
      nextDueOn: "2026-09-26",
    });
    const res = await session.del(`/api/reviews/${reviewId}?date=${TODAY}`);
    expect(res.status).toBe(200);
    expect(await itemState(itemId)).toEqual({ stop: 1, dueOn: TODAY });
  });
});

describe("saveReview guards against an item that moved in the meantime", () => {
  it("stores nothing and leaves the item alone when its stop or due date changed", async () => {
    const { session, itemId } = await withItem("tom@example.com");
    const stale = {
      reviewedOn: TODAY,
      confidence: "confident" as const,
      stopBefore: 3, // the item is really on stop 4
      stopAfter: 4,
      wasDueOn: "2026-09-21",
      nextDueOn: "2026-09-29",
      manual: false,
    };
    expect(await saveReview(getDb(env.DB), session.userId, itemId, stale)).toBeNull();
    expect(await itemState(itemId)).toEqual({ stop: 4, dueOn: "2026-09-21" });
    const stored = await env.DB.prepare("SELECT id FROM reviews WHERE item_id = ?")
      .bind(itemId)
      .all();
    expect(stored.results).toHaveLength(0);
  });
});
