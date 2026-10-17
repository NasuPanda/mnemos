import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type {
  ApiError,
  DeleteSectionResponse,
  SectionResponse,
  SectionsResponse,
  TodayResponse,
} from "../contract";
import { addImage, addItem, addReview, addSection } from "../test/fixtures";
import { signIn, type Session } from "../test/session";

const TODAY = "2026-09-24";

async function create(session: Session, name: string, code: string) {
  const res = await session.post("/api/sections", { name, code });
  return { status: res.status, body: (await res.json()) as SectionResponse & ApiError };
}

async function todayOf(session: Session) {
  return (await (await session.get(`/api/today?date=${TODAY}`)).json()) as TodayResponse;
}

describe("POST /api/sections: creating a section", () => {
  it("adds it last in the person's order, with the code they chose", async () => {
    const s = await signIn("sec-a@example.com");
    await addSection(s.userId, { code: "GR", position: 4 });

    const { status, body } = await create(s, "Compilers", "COM");
    expect(status).toBe(201);
    expect(body.section).toMatchObject({ name: "Compilers", code: "COM", position: 5 });
    expect((await todayOf(s)).sections.map((section) => section.code)).toEqual(["GR", "COM"]);
  });

  it("colours new sections M2 → M3 → M4 → M2 and moves the counter on", async () => {
    const s = await signIn("sec-b@example.com");
    expect((await todayOf(s)).nextLine).toBe("m2");

    const lines = [];
    for (const [name, code] of [
      ["Graphs", "GR"],
      ["Data structures", "DS"],
      ["Databases", "SQL"],
      ["Networks", "NET"],
    ]) {
      lines.push((await create(s, name!, code!)).body.section.line);
    }
    expect(lines).toEqual(["m2", "m3", "m4", "m2"]);
    expect((await todayOf(s)).nextLine).toBe("m3");
  });

  it("never reuses a deleted section's colour: the counter only moves forward", async () => {
    const s = await signIn("sec-c@example.com");
    const graphs = (await create(s, "Graphs", "GR")).body.section;
    await create(s, "Data structures", "DS");
    await s.del(`/api/sections/${graphs.id}`);

    const { body } = await create(s, "Compilers", "COM");
    expect(body.section.line).toBe("m4");
    expect(body.nextLine).toBe("m2");
  });

  it("stores the code in capitals and the name without surrounding spaces", async () => {
    const s = await signIn("sec-d@example.com");
    const { body } = await create(s, "  Operating systems 2 ", " os2 ");
    expect(body.section).toMatchObject({ name: "Operating systems 2", code: "OS2" });
  });

  it("refuses a code the person already uses, or one that isn't 2–3 of A–Z and 0–9", async () => {
    const s = await signIn("sec-e@example.com");
    await addSection(s.userId, { code: "GR" });
    expect(await create(s, "Gráfok", "gr")).toMatchObject({
      status: 422,
      body: { error: "code-taken" },
    });
    expect((await create(s, "Compilers", "C")).body.error).toBe("code-length");
    expect((await create(s, "Compilers", "C-1")).body.error).toBe("code-characters");
    expect((await todayOf(s)).nextLine).toBe("m2");
  });

  it("needs a name of up to 60 characters", async () => {
    const s = await signIn("sec-f@example.com");
    expect((await create(s, "  ", "AB")).body.error).toBe("name-required");
    expect((await create(s, "x".repeat(61), "AB")).body.error).toBe("name-too-long");
    expect((await s.post("/api/sections", { name: "No code" })).status).toBe(400);
  });

  it("lets two people use the same code", async () => {
    const ali = await signIn("sec-g@example.com");
    const bea = await signIn("sec-h@example.com");
    expect((await create(ali, "Graphs", "GR")).status).toBe(201);
    expect((await create(bea, "Graphs", "GR")).status).toBe(201);
  });
});

describe("PATCH /api/sections/:id: renaming and changing the code", () => {
  it("changes the name and code but never the colour", async () => {
    const s = await signIn("sec-i@example.com");
    const graphs = (await create(s, "Graphs", "GR")).body.section;

    const res = await s.patch(`/api/sections/${graphs.id}`, { name: "Gráfok", code: "gra" });
    expect(res.status).toBe(200);
    const { section } = (await res.json()) as SectionResponse;
    expect(section).toEqual({ ...graphs, name: "Gráfok", code: "GRA" });
  });

  it("lets a section keep its own code, but not take another section's", async () => {
    const s = await signIn("sec-j@example.com");
    const graphs = (await create(s, "Graphs", "GR")).body.section;
    await create(s, "Data structures", "DS");

    expect((await s.patch(`/api/sections/${graphs.id}`, { code: "GR" })).status).toBe(200);
    const taken = await s.patch(`/api/sections/${graphs.id}`, { code: "ds" });
    expect(taken.status).toBe(422);
    expect(((await taken.json()) as ApiError).error).toBe("code-taken");
  });

  it("answers 404 for someone else's section", async () => {
    const owner = await signIn("sec-k@example.com");
    const graphs = (await create(owner, "Graphs", "GR")).body.section;
    const stranger = await signIn("sec-l@example.com");

    expect((await stranger.patch(`/api/sections/${graphs.id}`, { name: "Mine" })).status).toBe(404);
    expect((await todayOf(owner)).sections[0]?.name).toBe("Graphs");
  });
});

describe("PUT /api/sections/order: reordering", () => {
  it("puts the sections in the given order, which today's data follows", async () => {
    const s = await signIn("sec-m@example.com");
    const gr = (await create(s, "Graphs", "GR")).body.section.id;
    const ds = (await create(s, "Data structures", "DS")).body.section.id;
    const os = (await create(s, "Operating systems", "OS")).body.section.id;

    const res = await s.put("/api/sections/order", { ids: [os, gr, ds] });
    expect(res.status).toBe(200);
    const { sections } = (await res.json()) as SectionsResponse;
    expect(sections.map((section) => section.code)).toEqual(["OS", "GR", "DS"]);
    expect((await todayOf(s)).sections.map((section) => section.code)).toEqual(["OS", "GR", "DS"]);
  });

  it("needs every one of the person's sections exactly once, and nobody else's", async () => {
    const s = await signIn("sec-n@example.com");
    const gr = (await create(s, "Graphs", "GR")).body.section.id;
    const ds = (await create(s, "Data structures", "DS")).body.section.id;
    const other = await signIn("sec-o@example.com");
    const theirs = (await create(other, "Theirs", "TH")).body.section.id;

    for (const ids of [[gr], [gr, ds, ds], [gr, ds, theirs], [gr, theirs]]) {
      const res = await s.put("/api/sections/order", { ids });
      expect(res.status, JSON.stringify(ids)).toBe(422);
    }
    expect((await s.put("/api/sections/order", { ids: "GR,DS" })).status).toBe(400);
  });
});

describe("DELETE /api/sections/:id: deleting a section", () => {
  it("deletes the section with its items, their reviews and image rows", async () => {
    const s = await signIn("sec-p@example.com");
    const graphs = await addSection(s.userId, { code: "GR" });
    const os = await addSection(s.userId, { code: "OS", position: 2 });
    const item = await addItem(s.userId, graphs, { name: "Dijkstra", dueOn: TODAY });
    await addItem(s.userId, graphs, { name: "Bellman–Ford", dueOn: TODAY });
    await addImage(item, { key: `${"a".repeat(64)}.webp`, side: "problem", position: 1 });
    await addReview(s.userId, item, { reviewedOn: "2026-09-20", nextDueOn: TODAY });
    const kept = await addItem(s.userId, os, { name: "Mutex", dueOn: TODAY });

    const res = await s.del(`/api/sections/${graphs}`);
    expect(res.status).toBe(200);
    expect((await res.json()) as DeleteSectionResponse).toEqual({ deletedItems: 2 });

    const count = async (sql: string) =>
      (await env.DB.prepare(sql).bind(item).first<{ n: number }>())?.n;
    expect(await count("SELECT COUNT(*) AS n FROM reviews WHERE item_id = ?")).toBe(0);
    expect(await count("SELECT COUNT(*) AS n FROM item_images WHERE item_id = ?")).toBe(0);
    const today = await todayOf(s);
    expect(today.sections.map((section) => section.code)).toEqual(["OS"]);
    expect(today.items.map((i) => i.id)).toEqual([kept]);
  });

  it("answers 404 for someone else's section and leaves it alone", async () => {
    const owner = await signIn("sec-q@example.com");
    const graphs = await addSection(owner.userId, { code: "GR" });
    await addItem(owner.userId, graphs, { name: "Dijkstra", dueOn: TODAY });
    const stranger = await signIn("sec-r@example.com");

    expect((await stranger.del(`/api/sections/${graphs}`)).status).toBe(404);
    expect((await todayOf(owner)).items).toHaveLength(1);
  });
});
