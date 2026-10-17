import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type {
  CreateItemRequest,
  ItemErrorResponse,
  ItemResponse,
  ItemsResponse,
  TodayResponse,
} from "../contract";
import { addImage, addItem, addReview, addSection, itemState } from "../test/fixtures";
import { signIn, type Session } from "../test/session";

const TODAY = "2026-09-24";
const key = (n: number) => `${n.toString(16).padStart(64, "0")}.webp`;

function fields(sectionId: number, extra: Partial<CreateItemRequest> = {}): CreateItemRequest {
  return {
    date: TODAY,
    sectionId,
    name: "Why Dijkstra fails on negative edges",
    description: "Shortest paths, week 4.",
    problemUrl: "example.edu/algo/lecture-07.pdf",
    problemText: "Run Dijkstra from S on the graph in Fig. 1.",
    answerUrl: "",
    answerText: "Dijkstra makes A final at distance 2.",
    sideNote: null,
    images: [],
    ...extra,
  };
}

async function withSection(email: string) {
  const session = await signIn(email);
  const section = await addSection(session.userId, { code: "GR" });
  return { session, section };
}

async function createItem(session: Session, body: CreateItemRequest) {
  const res = await session.post("/api/items", body);
  return { status: res.status, body: (await res.json()) as ItemResponse & ItemErrorResponse };
}

describe("GET /api/items: the Items list", () => {
  it("lists every item of the person's, oldest first, flagging those reviewed that day", async () => {
    const { session, section } = await withSection("it-a@example.com");
    const late = await addItem(session.userId, section, { name: "Late", dueOn: "2026-09-21" });
    const later = await addItem(session.userId, section, { name: "Later", dueOn: "2026-10-01" });
    await addReview(session.userId, later, { reviewedOn: TODAY, nextDueOn: "2026-10-01" });
    const stranger = await withSection("it-b@example.com");
    await addItem(stranger.session.userId, stranger.section, { name: "Theirs", dueOn: TODAY });

    const res = await session.get(`/api/items?date=${TODAY}`);
    expect(res.status).toBe(200);
    const { items } = (await res.json()) as ItemsResponse;
    expect(items.map((item) => [item.id, item.name, item.reviewedToday])).toEqual([
      [late, "Late", false],
      [later, "Later", true],
    ]);
    expect(items[0]).toMatchObject({ sectionId: section, stop: 1, dueOn: "2026-09-21" });
  });

  it("needs the browser's date", async () => {
    const session = await signIn("it-c@example.com");
    expect((await session.get("/api/items")).status).toBe(400);
  });
});

describe("GET /api/items/:id: one item for the editor", () => {
  it("has every field, the images in order and how many reviews it has", async () => {
    const { session, section } = await withSection("it-d@example.com");
    const item = await addItem(session.userId, section, { name: "Dijkstra", dueOn: TODAY });
    await addImage(item, { key: key(2), side: "answer", position: 1 });
    await addImage(item, { key: key(1), side: "problem", position: 1 });
    await addReview(session.userId, item, { reviewedOn: "2026-09-20", nextDueOn: TODAY });

    const res = await session.get(`/api/items/${item}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as ItemResponse;
    expect(body.item).toMatchObject({ id: item, name: "Dijkstra", stop: 1, dueOn: TODAY });
    expect(body.item.images.map((image) => image.key)).toEqual([key(1), key(2)]);
    expect(body.reviews).toBe(1);
  });

  it("answers 404 for someone else's item", async () => {
    const owner = await withSection("it-e@example.com");
    const item = await addItem(owner.session.userId, owner.section, { name: "X", dueOn: TODAY });
    const stranger = await signIn("it-f@example.com");
    expect((await stranger.get(`/api/items/${item}`)).status).toBe(404);
  });
});

describe("POST /api/items: adding an item", () => {
  it("starts it on stop 1, due the day it's added, so it is on today's list", async () => {
    const { session, section } = await withSection("it-g@example.com");
    const { status, body } = await createItem(session, fields(section));

    expect(status).toBe(201);
    expect(body.item).toMatchObject({ sectionId: section, stop: 1, dueOn: TODAY });
    const today = (await (await session.get(`/api/today?date=${TODAY}`)).json()) as TodayResponse;
    expect(today.items.map((item) => item.id)).toEqual([body.item.id]);
  });

  it("tidies what was typed: links get https://, empty fields are stored as nothing", async () => {
    const { session, section } = await withSection("it-h@example.com");
    const { body } = await createItem(session, fields(section, { name: "  Dijkstra  " }));
    expect(body.item).toMatchObject({
      name: "Dijkstra",
      problemUrl: "https://example.edu/algo/lecture-07.pdf",
      answerUrl: null,
      sideNote: null,
    });
  });

  it("stores each side's images in the order given", async () => {
    const { session, section } = await withSection("it-i@example.com");
    const images = [
      { key: key(3), side: "problem" as const },
      { key: key(1), side: "answer" as const },
      { key: key(2), side: "problem" as const },
    ];
    const { body } = await createItem(session, fields(section, { images }));
    expect(body.item.images).toEqual([
      { key: key(3), side: "problem", position: 1 },
      { key: key(2), side: "problem", position: 2 },
      { key: key(1), side: "answer", position: 1 },
    ]);
  });

  it("refuses an item without a Name, and says which field is wrong", async () => {
    const { session, section } = await withSection("it-j@example.com");
    const { status, body } = await createItem(
      session,
      fields(section, { name: " ", problemUrl: "javascript:alert(1)" }),
    );
    expect(status).toBe(422);
    expect(body).toEqual({
      error: "invalid-fields",
      fields: { name: "required", problemUrl: "not-a-link" },
    });
  });

  it("needs a section of the person's own", async () => {
    const { session } = await withSection("it-k@example.com");
    const stranger = await withSection("it-l@example.com");
    expect((await createItem(session, fields(stranger.section))).body.error).toBe(
      "section-not-found",
    );
    expect((await createItem(session, fields(0))).status).toBe(422);
  });

  it("refuses a malformed image list, and the same image twice on one side", async () => {
    const { session, section } = await withSection("it-m@example.com");
    const bad = await createItem(
      session,
      fields(section, { images: [{ key: "../x.webp", side: "problem" }] }),
    );
    expect(bad.status).toBe(400);
    const twice = await createItem(
      session,
      fields(section, {
        images: [
          { key: key(1), side: "problem" },
          { key: key(1), side: "problem" },
        ],
      }),
    );
    expect(twice.body.error).toBe("images-duplicate");
  });

  it("stops at 2,000 different images per person; one already in use doesn't count again", async () => {
    const { session, section } = await withSection("it-n@example.com");
    const full = await addItem(session.userId, section, { name: "Full", dueOn: TODAY });
    await env.DB.prepare(
      `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 2000)
       INSERT INTO item_images (item_id, side, image_key, position)
       SELECT ?, 'problem', printf('%064x.webp', i), i FROM n`,
    )
      .bind(full)
      .run();

    const reused = await createItem(
      session,
      fields(section, { images: [{ key: key(7), side: "answer" }] }),
    );
    expect(reused.status).toBe(201);
    const extra = await createItem(
      session,
      fields(section, { images: [{ key: key(2001), side: "answer" }] }),
    );
    expect(extra).toMatchObject({ status: 422, body: { error: "images-limit" } });
  });
});

describe("PUT /api/items/:id: saving an edit", () => {
  it("saves every field and the new image order, and keeps the stop and due date", async () => {
    const { session, section } = await withSection("it-o@example.com");
    const other = await addSection(session.userId, { code: "DS", position: 2 });
    const item = await addItem(session.userId, section, {
      name: "Old",
      dueOn: "2026-09-21",
      stop: 4,
    });
    await addImage(item, { key: key(1), side: "problem", position: 1 });
    await addImage(item, { key: key(2), side: "problem", position: 2 });

    const res = await session.put(`/api/items/${item}`, {
      ...fields(other, { name: "New", sideNote: "Reach for Bellman–Ford." }),
      images: [
        { key: key(2), side: "problem" },
        { key: key(3), side: "answer" },
      ],
    });
    expect(res.status).toBe(200);
    const { item: saved } = (await res.json()) as ItemResponse;
    expect(saved).toMatchObject({
      sectionId: other,
      name: "New",
      sideNote: "Reach for Bellman–Ford.",
      stop: 4,
      dueOn: "2026-09-21",
    });
    expect(saved.images.map((image) => [image.key, image.side, image.position])).toEqual([
      [key(2), "problem", 1],
      [key(3), "answer", 1],
    ]);
    expect(await itemState(item)).toEqual({ stop: 4, dueOn: "2026-09-21" });
  });

  it("can't move an item into someone else's section or touch someone else's item", async () => {
    const owner = await withSection("it-p@example.com");
    const item = await addItem(owner.session.userId, owner.section, { name: "Mine", dueOn: TODAY });
    const stranger = await withSection("it-q@example.com");

    const intoTheirs = await owner.session.put(`/api/items/${item}`, fields(stranger.section));
    expect(intoTheirs.status).toBe(422);
    const theirEdit = await stranger.session.put(`/api/items/${item}`, fields(stranger.section));
    expect(theirEdit.status).toBe(404);
    const after = (await (await owner.session.get(`/api/items/${item}`)).json()) as ItemResponse;
    expect(after.item.name).toBe("Mine");
  });
});

describe("DELETE /api/items/:id: deleting an item", () => {
  it("deletes it with its reviews and image rows", async () => {
    const { session, section } = await withSection("it-r@example.com");
    const item = await addItem(session.userId, section, { name: "Gone", dueOn: TODAY });
    await addImage(item, { key: key(1), side: "problem", position: 1 });
    await addReview(session.userId, item, { reviewedOn: "2026-09-20", nextDueOn: TODAY });

    expect((await session.del(`/api/items/${item}`)).status).toBe(200);
    expect((await session.get(`/api/items/${item}`)).status).toBe(404);
    const left = await env.DB.prepare(
      "SELECT (SELECT COUNT(*) FROM reviews WHERE item_id = ?1) + (SELECT COUNT(*) FROM item_images WHERE item_id = ?1) AS n",
    )
      .bind(item)
      .first<{ n: number }>();
    expect(left?.n).toBe(0);
  });

  it("answers 404 for someone else's item and leaves it alone", async () => {
    const owner = await withSection("it-s@example.com");
    const item = await addItem(owner.session.userId, owner.section, { name: "Mine", dueOn: TODAY });
    const stranger = await signIn("it-t@example.com");
    expect((await stranger.del(`/api/items/${item}`)).status).toBe(404);
    expect((await owner.session.get(`/api/items/${item}`)).status).toBe(200);
  });
});
