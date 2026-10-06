import { describe, expect, it } from "vitest";
import {
  addStop,
  addStopRefusal,
  DEFAULT_LADDER,
  gapFor,
  lastStop,
  newStopGap,
  removalEffect,
  removeStop,
  setGap,
  stopAfterRemoval,
  validateLadder,
} from "./ladder";

describe("Ladder", () => {
  it("defaults to 1, 2, 3, 5, 7, 14 and 28 days", () => {
    expect(DEFAULT_LADDER).toEqual([1, 2, 3, 5, 7, 14, 28]);
    expect(validateLadder(DEFAULT_LADDER)).toEqual([]);
  });

  it("has stop 7, the Végállomás, as its last stop", () => {
    expect(lastStop(DEFAULT_LADDER)).toBe(7);
    expect(gapFor(DEFAULT_LADDER, 7)).toBe(28);
  });

  it("gives each stop its gap in days", () => {
    expect(gapFor(DEFAULT_LADDER, 1)).toBe(1);
    expect(gapFor(DEFAULT_LADDER, 4)).toBe(5);
  });

  it("refuses to look up a stop that isn't on the ladder", () => {
    expect(() => gapFor(DEFAULT_LADDER, 0)).toThrow(RangeError);
    expect(() => gapFor(DEFAULT_LADDER, 8)).toThrow(RangeError);
  });
});

describe("Ladder edits › validation", () => {
  it("accepts 1 to 7 stops with gaps from 1 to 365 days, each longer than the one before", () => {
    expect(validateLadder([1])).toEqual([]);
    expect(validateLadder([365])).toEqual([]);
    expect(validateLadder([1, 2, 4, 8, 16, 32, 365])).toEqual([]);
  });

  it("needs at least one stop", () => {
    expect(validateLadder([])).toEqual([{ kind: "no-stops" }]);
  });

  it("allows at most 7 stops", () => {
    expect(validateLadder([1, 2, 3, 4, 5, 6, 7, 8])).toEqual([{ kind: "too-many-stops", max: 7 }]);
  });

  it("asks for a whole number from 1 to 365 (stop 1 set to 0 days, page 18)", () => {
    expect(validateLadder([0, 2, 3])).toEqual([
      { kind: "gap-out-of-range", stop: 1, min: 1, max: 365 },
    ]);
    expect(validateLadder([1, 366])).toEqual([
      { kind: "gap-out-of-range", stop: 2, min: 1, max: 365 },
    ]);
    expect(validateLadder([1, 2.5])).toEqual([
      { kind: "gap-out-of-range", stop: 2, min: 1, max: 365 },
    ]);
  });

  it("asks each gap to be longer than the one before (stop 5 set to 4 days, page 30)", () => {
    expect(validateLadder([1, 2, 3, 5, 4, 14, 28])).toEqual([
      { kind: "gap-not-longer", stop: 5, previous: { stop: 4, gap: 5 } },
    ]);
  });

  it("treats an equal gap as not longer", () => {
    expect(validateLadder([1, 2, 2])).toEqual([
      { kind: "gap-not-longer", stop: 3, previous: { stop: 2, gap: 2 } },
    ]);
  });

  it("reports only the broken stop when a gap is out of range, not its neighbour too", () => {
    expect(validateLadder([1, 0, 3])).toEqual([
      { kind: "gap-out-of-range", stop: 2, min: 1, max: 365 },
    ]);
  });

  it("changes one stop's gap without touching the others", () => {
    expect(setGap(DEFAULT_LADDER, 5, 4)).toEqual([1, 2, 3, 5, 4, 14, 28]);
    expect(DEFAULT_LADDER).toEqual([1, 2, 3, 5, 7, 14, 28]);
  });
});

describe("Ladder edits › adding a stop", () => {
  it("adds a new last stop", () => {
    const result = addStop([1, 2, 3]);
    expect(result).toEqual({ ok: true, value: [1, 2, 3, 6] });
  });

  it("starts the new stop at double the previous last gap", () => {
    expect(newStopGap([1, 2, 3, 5, 7, 28])).toBe(56);
  });

  it("caps the new stop's gap at 365 days", () => {
    expect(newStopGap([30, 200])).toBe(365);
    expect(addStop([30, 200])).toEqual({ ok: true, value: [30, 200, 365] });
  });

  it("keeps the ladder valid after adding", () => {
    const result = addStop([1, 2, 3, 5, 7, 14]);
    expect(result.ok && validateLadder(result.value)).toEqual([]);
  });

  it("refuses an 8th stop: a ladder has at most 7 stops (page 31)", () => {
    expect(addStopRefusal(DEFAULT_LADDER)).toBe("max-stops");
    expect(addStop(DEFAULT_LADDER)).toEqual({ ok: false, error: "max-stops" });
  });

  it("refuses a stop after a 365-day last stop, since no longer gap exists", () => {
    expect(addStopRefusal([7, 365])).toBe("last-gap-at-max");
    expect(addStop([7, 365])).toEqual({ ok: false, error: "last-gap-at-max" });
  });
});

describe("Ladder edits › removing a stop", () => {
  it("takes the stop's gap out of the ladder", () => {
    expect(removeStop(DEFAULT_LADDER, 3)).toEqual({ ok: true, value: [1, 2, 5, 7, 14, 28] });
    expect(removeStop(DEFAULT_LADDER, 1)).toEqual({ ok: true, value: [2, 3, 5, 7, 14, 28] });
    expect(removeStop(DEFAULT_LADDER, 7)).toEqual({ ok: true, value: [1, 2, 3, 5, 7, 14] });
  });

  it("moves the removed stop's items down one stop (stop 3 → 2)", () => {
    expect(stopAfterRemoval(3, 3)).toBe(2);
  });

  it("renumbers the stops after it (stop 4 becomes stop 3, page 32)", () => {
    expect(stopAfterRemoval(4, 3)).toBe(3);
    expect(stopAfterRemoval(7, 3)).toBe(6);
  });

  it("leaves the stops before it alone", () => {
    expect(stopAfterRemoval(1, 3)).toBe(1);
    expect(stopAfterRemoval(2, 3)).toBe(2);
  });

  it("keeps stop 1's items on the new stop 1 when stop 1 is removed", () => {
    expect(stopAfterRemoval(1, 1)).toBe(1);
    expect(stopAfterRemoval(2, 1)).toBe(1);
    expect(stopAfterRemoval(3, 1)).toBe(2);
  });

  it("matches stop = stop − 1 where stop ≥ max(k, 2), for every stop and every k", () => {
    for (let removed = 1; removed <= 7; removed++) {
      for (let stop = 1; stop <= 7; stop++) {
        const expected = stop >= Math.max(removed, 2) ? stop - 1 : stop;
        expect(stopAfterRemoval(stop, removed), `stop ${stop}, removing ${removed}`).toBe(expected);
      }
    }
  });

  it("keeps every item on a stop of the new ladder", () => {
    for (let removed = 1; removed <= 7; removed++) {
      const result = removeStop(DEFAULT_LADDER, removed);
      if (!result.ok) throw new Error("expected removal to succeed");
      for (let stop = 1; stop <= 7; stop++) {
        const after = stopAfterRemoval(stop, removed);
        expect(after).toBeGreaterThanOrEqual(1);
        expect(after).toBeLessThanOrEqual(lastStop(result.value));
      }
    }
  });

  it("explains the move before confirming: 61 items move down to stop 2 (2 days), page 32", () => {
    expect(removalEffect(DEFAULT_LADDER, 3)).toEqual({
      ok: true,
      value: { movesTo: 2, movesToGap: 2, laterStopsRenumber: true },
    });
  });

  it("explains removing stop 1: its items stay on the new stop 1, which has stop 2's gap", () => {
    expect(removalEffect(DEFAULT_LADDER, 1)).toEqual({
      ok: true,
      value: { movesTo: 1, movesToGap: 2, laterStopsRenumber: true },
    });
  });

  it("explains removing the last stop: nothing after it renumbers", () => {
    expect(removalEffect(DEFAULT_LADDER, 7)).toEqual({
      ok: true,
      value: { movesTo: 6, movesToGap: 14, laterStopsRenumber: false },
    });
  });

  it("always keeps at least one stop", () => {
    expect(removeStop([5], 1)).toEqual({ ok: false, error: "last-stop" });
    expect(removalEffect([5], 1)).toEqual({ ok: false, error: "last-stop" });
  });

  it("refuses to remove a stop that isn't on the ladder", () => {
    expect(() => removeStop(DEFAULT_LADDER, 8)).toThrow(RangeError);
  });

  it("keeps the ladder valid after removing any stop", () => {
    for (let removed = 1; removed <= 7; removed++) {
      const result = removeStop(DEFAULT_LADDER, removed);
      expect(result.ok && validateLadder(result.value)).toEqual([]);
    }
  });
});
