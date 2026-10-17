import { describe, expect, it } from "vitest";
import type { LadderErrorResponse, LadderResponse, RateResponse } from "../contract";
import { addItem, addSection, itemState, setLadder, storedLadder } from "../test/fixtures";
import { signIn, type Session } from "../test/session";

const DEFAULT = [1, 2, 3, 5, 7, 14, 28];
const TODAY = "2026-09-24";

type Answer = { status: number; body: LadderResponse & LadderErrorResponse };

async function answer(res: Response): Promise<Answer> {
  return { status: res.status, body: (await res.json()) as Answer["body"] };
}

const setGap = (s: Session, stop: number, gap: number, ladder = DEFAULT) =>
  s.patch(`/api/ladder/stops/${stop}`, { ladder, gap }).then(answer);
const addStop = (s: Session, ladder = DEFAULT) =>
  s.post("/api/ladder/stops", { ladder }).then(answer);
const removeStop = (s: Session, stop: number, ladder = DEFAULT) =>
  s.del(`/api/ladder/stops/${stop}?ladder=${ladder.join(",")}`).then(answer);

/** One item on each stop of the default ladder, due on different days. */
async function onEveryStop(s: Session) {
  const section = await addSection(s.userId, { code: "GR" });
  const ids: number[] = [];
  for (let stop = 1; stop <= 7; stop++) {
    ids.push(
      await addItem(s.userId, section, { name: `Stop ${stop}`, stop, dueOn: `2026-10-0${stop}` }),
    );
  }
  return ids;
}

async function stops(ids: number[]) {
  return Promise.all(ids.map(async (id) => (await itemState(id))?.stop));
}

describe("PATCH /api/ladder/stops/:stop: changing a gap", () => {
  it("changes stop 4 from 5 to 6 days and leaves the items' due dates alone", async () => {
    const s = await signIn("ari@example.com");
    const [item] = await onEveryStop(s);
    const { status, body } = await setGap(s, 4, 6);
    expect(status).toBe(200);
    expect(body.ladder).toEqual([1, 2, 3, 6, 7, 14, 28]);
    expect(await storedLadder(s.userId)).toEqual([1, 2, 3, 6, 7, 14, 28]);
    expect(await itemState(item as number)).toEqual({ stop: 1, dueOn: "2026-10-01" });
  });

  it("refuses a gap that isn't a whole number from 1 to 365", async () => {
    const s = await signIn("bea@example.com");
    for (const gap of [0, 366, 2.5]) {
      const { status, body } = await setGap(s, 1, gap);
      expect(status).toBe(422);
      expect(body.error).toBe("gap-out-of-range");
      expect(body.ladder).toEqual(DEFAULT);
    }
    expect(await storedLadder(s.userId)).toEqual(DEFAULT);
  });

  it("refuses stop 5 at 4 days: make it longer than stop 4 (5 days)", async () => {
    const s = await signIn("cyd@example.com");
    const { status, body } = await setGap(s, 5, 4);
    expect(status).toBe(422);
    expect(body.issue).toEqual({ kind: "gap-not-longer", previous: { stop: 4, gap: 5 } });
    expect(await storedLadder(s.userId)).toEqual(DEFAULT);
  });

  it("refuses stop 3 at 9 days: make it shorter than stop 4 (5 days)", async () => {
    const s = await signIn("dov@example.com");
    const { status, body } = await setGap(s, 3, 9);
    expect(status).toBe(422);
    expect(body.issue).toEqual({ kind: "gap-not-shorter", next: { stop: 4, gap: 5 } });
  });

  it("changes nothing if the ladder changed since the person saw it, and says what it is now", async () => {
    const s = await signIn("eve@example.com");
    await setLadder(s.userId, [1, 2, 4]);
    const { status, body } = await setGap(s, 2, 3, DEFAULT);
    expect(status).toBe(409);
    expect(body).toEqual({ error: "ladder-changed", ladder: [1, 2, 4] });
    expect(await storedLadder(s.userId)).toEqual([1, 2, 4]);
  });

  it("refuses a stop that isn't on the ladder, and malformed requests", async () => {
    const s = await signIn("fin@example.com");
    expect((await setGap(s, 8, 40)).status).toBe(404);
    expect((await s.patch("/api/ladder/stops/2", { gap: 3 })).status).toBe(400);
    expect((await s.patch("/api/ladder/stops/2", { ladder: DEFAULT, gap: "3" })).status).toBe(400);
    expect((await s.patch("/api/ladder/stops/0", { ladder: DEFAULT, gap: 3 })).status).toBe(400);
  });

  it("is used for the next rating: Confident from stop 4 lands 6 days later", async () => {
    const s = await signIn("gil@example.com");
    const section = await addSection(s.userId, { code: "GR" });
    const item = await addItem(s.userId, section, { name: "Stop 3", stop: 3, dueOn: TODAY });
    await setGap(s, 4, 6);
    const res = await s.post("/api/reviews", {
      itemId: item,
      date: TODAY,
      confidence: "confident",
    });
    expect(((await res.json()) as RateResponse).item).toEqual({
      id: item,
      stop: 4,
      dueOn: "2026-09-30",
    });
  });
});

describe("POST /api/ladder/stops: adding a stop", () => {
  it("adds a new last stop at double the last gap", async () => {
    const s = await signIn("hob@example.com");
    await setLadder(s.userId, [1, 2, 3, 5, 7, 28]);
    const { status, body } = await addStop(s, [1, 2, 3, 5, 7, 28]);
    expect(status).toBe(201);
    expect(body.ladder).toEqual([1, 2, 3, 5, 7, 28, 56]);
    expect(await storedLadder(s.userId)).toEqual([1, 2, 3, 5, 7, 28, 56]);
  });

  it("caps the new gap at 365 days", async () => {
    const s = await signIn("ivo@example.com");
    await setLadder(s.userId, [30, 200]);
    expect((await addStop(s, [30, 200])).body.ladder).toEqual([30, 200, 365]);
  });

  it("refuses an 8th stop: a ladder has at most 7 stops", async () => {
    const s = await signIn("jem@example.com");
    const { status, body } = await addStop(s);
    expect(status).toBe(422);
    expect(body).toEqual({ error: "max-stops", ladder: DEFAULT });
  });

  it("refuses a stop after a 365-day last stop", async () => {
    const s = await signIn("kit@example.com");
    await setLadder(s.userId, [7, 365]);
    expect((await addStop(s, [7, 365])).body.error).toBe("last-gap-at-max");
  });

  it("adds nothing if the ladder changed since the person saw it", async () => {
    const s = await signIn("lev@example.com");
    await setLadder(s.userId, [1, 2]);
    expect((await addStop(s, [1, 2, 3])).status).toBe(409);
    expect(await storedLadder(s.userId)).toEqual([1, 2]);
  });
});

describe("DELETE /api/ladder/stops/:stop: removing a stop", () => {
  it("removes stop 3: its items move down to stop 2, and stop 4 becomes stop 3 (page 32)", async () => {
    const s = await signIn("mae@example.com");
    const ids = await onEveryStop(s);
    const { status, body } = await removeStop(s, 3);
    expect(status).toBe(200);
    expect(body.ladder).toEqual([1, 2, 5, 7, 14, 28]);
    expect(await storedLadder(s.userId)).toEqual([1, 2, 5, 7, 14, 28]);
    expect(await stops(ids)).toEqual([1, 2, 2, 3, 4, 5, 6]);
  });

  it("keeps every item's due date", async () => {
    const s = await signIn("ned@example.com");
    const ids = await onEveryStop(s);
    await removeStop(s, 3);
    const dues = await Promise.all(ids.map(async (id) => (await itemState(id))?.dueOn));
    expect(dues).toEqual(ids.map((_, index) => `2026-10-0${index + 1}`));
  });

  it("removes stop 1: its items stay on the new stop 1, with stop 2's", async () => {
    const s = await signIn("ora@example.com");
    const ids = await onEveryStop(s);
    expect((await removeStop(s, 1)).body.ladder).toEqual([2, 3, 5, 7, 14, 28]);
    expect(await stops(ids)).toEqual([1, 1, 2, 3, 4, 5, 6]);
  });

  it("removes the last stop: its items move to the new last stop", async () => {
    const s = await signIn("pip@example.com");
    const ids = await onEveryStop(s);
    expect((await removeStop(s, 7)).body.ladder).toEqual([1, 2, 3, 5, 7, 14]);
    expect(await stops(ids)).toEqual([1, 2, 3, 4, 5, 6, 6]);
  });

  it("always keeps at least one stop", async () => {
    const s = await signIn("rex@example.com");
    await setLadder(s.userId, [5]);
    const { status, body } = await removeStop(s, 1, [5]);
    expect(status).toBe(422);
    expect(body).toEqual({ error: "last-stop", ladder: [5] });
  });

  it("moves nothing if the ladder changed since the person saw it, so a stop is never removed twice", async () => {
    const s = await signIn("sam@example.com");
    const ids = await onEveryStop(s);
    expect((await removeStop(s, 3)).status).toBe(200);
    const again = await removeStop(s, 3);
    expect(again.status).toBe(409);
    expect(again.body.ladder).toEqual([1, 2, 5, 7, 14, 28]);
    expect(await stops(ids)).toEqual([1, 2, 2, 3, 4, 5, 6]);
  });

  it("leaves another person's items and ladder alone", async () => {
    const other = await signIn("tia@example.com");
    const theirs = await onEveryStop(other);
    const s = await signIn("uri@example.com");
    await onEveryStop(s);
    await removeStop(s, 3);
    expect(await stops(theirs)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(await storedLadder(other.userId)).toEqual(DEFAULT);
  });

  it("refuses a stop that isn't on the ladder, and requests without the ladder seen", async () => {
    const s = await signIn("val@example.com");
    expect((await removeStop(s, 8)).status).toBe(404);
    expect((await s.del("/api/ladder/stops/3")).status).toBe(400);
    expect((await s.del("/api/ladder/stops/3?ladder=1,two,3")).status).toBe(400);
  });
});
