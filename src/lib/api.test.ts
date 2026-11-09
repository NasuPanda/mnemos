import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError, httpApi, setApi, type MnemosApi } from "./api";

type Sent = { method: string; path: string; body: unknown };

let sent: Sent[] = [];

beforeEach(() => {
  sent = [];
  vi.stubGlobal("fetch", (path: string, init: RequestInit) => {
    const body = init.body;
    sent.push({
      method: init.method ?? "GET",
      path,
      body: typeof body === "string" ? JSON.parse(body) : body,
    });
    return Promise.resolve(Response.json({ ok: true }));
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  setApi(httpApi);
});

const ladder = [1, 2, 3, 5, 7, 14, 28];
const fields = {
  sectionId: 3,
  name: "villamos",
  description: null,
  problemUrl: null,
  problemText: "What is the Hungarian word for tram?",
  answerUrl: null,
  answerText: null,
  sideNote: null,
  images: [],
};
const blob = new Blob(["x"], { type: "image/webp" });

const routes: [string, (a: MnemosApi) => Promise<unknown>, Sent][] = [
  ["me", (a) => a.me(), { method: "GET", path: "/api/me", body: undefined }],
  [
    "today",
    (a) => a.today("2026-11-09"),
    { method: "GET", path: "/api/today?date=2026-11-09", body: undefined },
  ],
  [
    "day",
    (a) => a.day("2026-11-12", "2026-11-09"),
    { method: "GET", path: "/api/days/2026-11-12?today=2026-11-09", body: undefined },
  ],
  [
    "rate",
    (a) => a.rate({ itemId: 5, date: "2026-11-09", confidence: "neutral" }),
    {
      method: "POST",
      path: "/api/reviews",
      body: { itemId: 5, date: "2026-11-09", confidence: "neutral" },
    },
  ],
  [
    "undo",
    (a) => a.undo(41, "2026-11-09"),
    { method: "DELETE", path: "/api/reviews/41?date=2026-11-09", body: undefined },
  ],
  [
    "items",
    (a) => a.items("2026-11-09"),
    { method: "GET", path: "/api/items?date=2026-11-09", body: undefined },
  ],
  ["item", (a) => a.item(5), { method: "GET", path: "/api/items/5", body: undefined }],
  [
    "itemHistory",
    (a) => a.itemHistory(5),
    { method: "GET", path: "/api/items/5/history", body: undefined },
  ],
  [
    "createItem",
    (a) => a.createItem({ ...fields, date: "2026-11-09" }),
    { method: "POST", path: "/api/items", body: { ...fields, date: "2026-11-09" } },
  ],
  [
    "updateItem",
    (a) => a.updateItem(5, fields),
    { method: "PUT", path: "/api/items/5", body: fields },
  ],
  [
    "deleteItem",
    (a) => a.deleteItem(5),
    { method: "DELETE", path: "/api/items/5", body: undefined },
  ],
  [
    "createSection",
    (a) => a.createSection({ name: "Hungarian words", code: "HU" }),
    { method: "POST", path: "/api/sections", body: { name: "Hungarian words", code: "HU" } },
  ],
  [
    "updateSection",
    (a) => a.updateSection(3, { code: "HUN" }),
    { method: "PATCH", path: "/api/sections/3", body: { code: "HUN" } },
  ],
  [
    "reorderSections",
    (a) => a.reorderSections({ ids: [4, 3] }),
    { method: "PUT", path: "/api/sections/order", body: { ids: [4, 3] } },
  ],
  [
    "deleteSection",
    (a) => a.deleteSection(3),
    { method: "DELETE", path: "/api/sections/3", body: undefined },
  ],
  [
    "setGap",
    (a) => a.setGap(4, { ladder, gap: 6 }),
    { method: "PATCH", path: "/api/ladder/stops/4", body: { ladder, gap: 6 } },
  ],
  [
    "addStop",
    (a) => a.addStop({ ladder }),
    { method: "POST", path: "/api/ladder/stops", body: { ladder } },
  ],
  [
    "removeStop",
    (a) => a.removeStop(3, ladder),
    { method: "DELETE", path: "/api/ladder/stops/3?ladder=1,2,3,5,7,14,28", body: undefined },
  ],
  [
    "uploadImage",
    (a) => a.uploadImage("abc.webp", blob),
    { method: "PUT", path: "/api/images/abc.webp", body: blob },
  ],
];

describe("httpApi", () => {
  it.each(routes)("%s asks the Worker's route", async (_name, call, expected) => {
    await call(httpApi);
    expect(sent).toEqual([expected]);
  });

  it("shows images from /img/<key>", () => {
    expect(httpApi.imageUrl("abc.webp")).toBe("/img/abc.webp");
  });

  it("throws the Worker's refusal as an ApiError with its code", async () => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve(Response.json({ error: "code-taken" }, { status: 409 })),
    );
    const refusal = httpApi.createSection({ name: "Hungarian words", code: "HU" });
    await expect(refusal).rejects.toBeInstanceOf(ApiError);
    await expect(refusal).rejects.toMatchObject({ status: 409, code: "code-taken" });
  });
});

describe("api()", () => {
  it("is the Worker's API until another is set", () => {
    expect(api()).toBe(httpApi);
  });

  it("is the API setApi swapped in", () => {
    const practice = { ...httpApi, imageUrl: (key: string) => `blob:${key}` };
    setApi(practice);
    expect(api()).toBe(practice);
    expect(api().imageUrl("abc.webp")).toBe("blob:abc.webp");
  });
});
