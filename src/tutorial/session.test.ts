import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openSession, SESSION_KEY, type SessionStorage } from "./session";

const TODAY = "2026-11-10";

/** sessionStorage, in memory. */
function memoryStorage(): SessionStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

beforeEach(() => {
  // The practice copy never reaches the Worker for these routes; fail loudly if it does.
  vi.stubGlobal("fetch", () => Promise.reject(new Error("no network in the practice day")));
});
afterEach(() => vi.unstubAllGlobals());

describe("the practice session", () => {
  it("starts a new practice day on today, and keeps it", async () => {
    const storage = memoryStorage();
    const session = openSession(storage, TODAY);
    expect(session.startedOn).toBe(TODAY);
    const today = await session.api.today(TODAY);
    expect(today.sections.map((s) => s.code)).toEqual(["HU", "AL"]);
    expect(storage.data.has(SESSION_KEY)).toBe(true);
  });

  it("comes back after a reload with the same data and the same start date", async () => {
    const storage = memoryStorage();
    const first = openSession(storage, TODAY);
    const today = await first.api.today(TODAY);
    const villamos = today.items.find((item) => item.name === "villamos")!;
    await first.api.rate({ itemId: villamos.id, confidence: "confident", date: TODAY });

    // A reload past midnight: the practice day keeps its own today.
    const again = openSession(storage, "2026-11-11");
    expect(again.startedOn).toBe(TODAY);
    const after = await again.api.today(TODAY);
    expect(after.reviewsToday.map((review) => review.itemId)).toEqual([villamos.id]);
  });

  it("starts again when asked to, or when what was kept can't be used", async () => {
    for (const kept of ["{not json", JSON.stringify({ startedOn: TODAY, state: { version: 0 } })]) {
      const storage = memoryStorage();
      storage.setItem(SESSION_KEY, kept);
      const session = openSession(storage, TODAY);
      expect((await session.api.today(TODAY)).items, kept).toHaveLength(3);
    }

    const storage = memoryStorage();
    const first = openSession(storage, "2026-11-01");
    const fresh = openSession(storage, TODAY, { fresh: true });
    expect(fresh.startedOn).toBe(TODAY);
    first.close();
  });

  it("forgets the practice day on close", () => {
    const storage = memoryStorage();
    openSession(storage, TODAY).close();
    expect(storage.data.has(SESSION_KEY)).toBe(false);
  });

  it("prefills Egészségedre! in HU until the person saves an item of their own", async () => {
    const storage = memoryStorage();
    const session = openSession(storage, TODAY);
    const draft = session.draft();
    expect(draft).toMatchObject({ sectionId: 1, name: "Egészségedre!" });
    expect(draft?.answerText).toContain("Egészségetekre!");

    await session.api.createItem({
      sectionId: draft!.sectionId!,
      name: draft!.name,
      description: null,
      problemUrl: null,
      problemText: draft!.problemText,
      answerUrl: null,
      answerText: draft!.answerText,
      sideNote: null,
      images: [],
      date: TODAY,
    });
    expect(session.draft()).toBeNull();
    // Also after a reload.
    expect(openSession(storage, TODAY).draft()).toBeNull();
  });

  it("keeps the tour's step, so a reload comes back to it", () => {
    const storage = memoryStorage();
    const first = openSession(storage, TODAY);
    expect(first.step).toBe(0);
    first.setStep(5);
    expect(openSession(storage, TODAY).step).toBe(5);
    expect(openSession(storage, TODAY, { fresh: true }).step).toBe(0);
  });

  it("tells the tour when an item is saved and when one is rated", async () => {
    const events: string[] = [];
    const session = openSession(memoryStorage(), TODAY, { onEvent: (e) => events.push(e) });
    const today = await session.api.today(TODAY);
    const villamos = today.items.find((item) => item.name === "villamos")!;
    await session.api.rate({ itemId: villamos.id, confidence: "neutral", date: TODAY });
    await session.api.createItem({
      sectionId: 1,
      name: "Szia",
      description: null,
      problemUrl: null,
      problemText: "Hello?",
      answerUrl: null,
      answerText: null,
      sideNote: null,
      images: [],
      date: TODAY,
    });
    expect(events).toEqual(["rated", "created"]);
  });
});
