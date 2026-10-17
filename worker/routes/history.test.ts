import { describe, expect, it } from "vitest";
import type { ItemHistoryResponse } from "../contract";
import { addItem, addReview, addSection } from "../test/fixtures";
import { signIn } from "../test/session";

async function history(email: string) {
  const session = await signIn(email);
  const section = await addSection(session.userId, { code: "GR" });
  const get = async (itemId: number) => {
    const res = await session.get(`/api/items/${itemId}/history`);
    return { status: res.status, body: (await res.json()) as ItemHistoryResponse };
  };
  return { ...session, section, history: get };
}

describe("GET /api/items/:id/history", () => {
  it("gives the item as it is now and every review of it, newest first (page 20)", async () => {
    const s = await history("nia@example.com");
    const item = await addItem(s.userId, s.section, {
      name: "Why Dijkstra fails on negative edges",
      stop: 4,
      dueOn: "2026-09-21",
    });
    // The design draft's history, added out of order.
    const rows = [
      ["2026-09-10", "not_at_all", 3, 1, "2026-09-10", "2026-09-11", false],
      ["2026-09-03", "neutral", 1, 1, "2026-09-03", "2026-09-04", false],
      ["2026-09-04", "confident", 1, 2, "2026-09-04", "2026-09-07", true],
      ["2026-09-07", "confident", 2, 3, "2026-09-07", "2026-09-10", false],
      ["2026-09-11", "confident", 1, 2, "2026-09-11", "2026-09-13", false],
      ["2026-09-12", "confident", 2, 3, "2026-09-13", "2026-09-15", false],
      ["2026-09-16", "confident", 3, 4, "2026-09-15", "2026-09-21", false],
    ] as const;
    for (const [
      reviewedOn,
      confidence,
      stopBefore,
      stopAfter,
      wasDueOn,
      nextDueOn,
      manual,
    ] of rows) {
      await addReview(s.userId, item, {
        reviewedOn,
        confidence,
        stopBefore,
        stopAfter,
        wasDueOn,
        nextDueOn,
        manual,
      });
    }

    const { status, body } = await s.history(item);
    expect(status).toBe(200);
    expect(body.item).toEqual({
      id: item,
      sectionId: s.section,
      name: "Why Dijkstra fails on negative edges",
      stop: 4,
      dueOn: "2026-09-21",
    });
    expect(body.reviews.map((review) => review.reviewedOn)).toEqual([
      "2026-09-16",
      "2026-09-12",
      "2026-09-11",
      "2026-09-10",
      "2026-09-07",
      "2026-09-04",
      "2026-09-03",
    ]);
    expect(body.reviews[1]).toMatchObject({
      reviewedOn: "2026-09-12",
      confidence: "confident",
      stopBefore: 2,
      stopAfter: 3,
      wasDueOn: "2026-09-13",
      nextDueOn: "2026-09-15",
      manual: false,
    });
    expect(body.reviews[5]).toMatchObject({ reviewedOn: "2026-09-04", manual: true });
  });

  it("gives an item that has never been reviewed an empty history", async () => {
    const s = await history("oli@example.com");
    const item = await addItem(s.userId, s.section, { name: "New", dueOn: "2026-09-24" });
    const { status, body } = await s.history(item);
    expect(status).toBe(200);
    expect(body.reviews).toEqual([]);
  });

  it("only shows this item's reviews", async () => {
    const s = await history("pia@example.com");
    const item = await addItem(s.userId, s.section, { name: "This one", dueOn: "2026-09-24" });
    const other = await addItem(s.userId, s.section, { name: "Another", dueOn: "2026-09-24" });
    await addReview(s.userId, other, { reviewedOn: "2026-09-20", nextDueOn: "2026-09-24" });
    expect((await s.history(item)).body.reviews).toEqual([]);
  });

  it("won't show another person's item, or one that doesn't exist", async () => {
    const owner = await history("quin@example.com");
    const item = await addItem(owner.userId, owner.section, {
      name: "Private",
      dueOn: "2026-09-24",
    });
    await addReview(owner.userId, item, { reviewedOn: "2026-09-20", nextDueOn: "2026-09-24" });

    const stranger = await signIn("rae@example.com");
    expect((await stranger.get(`/api/items/${item}/history`)).status).toBe(404);
    expect((await stranger.get("/api/items/999999/history")).status).toBe(404);
    expect((await stranger.get("/api/items/abc/history")).status).toBe(400);
  });
});
