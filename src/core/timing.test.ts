import { describe, expect, it } from "vitest";
import { daysLate, reviewTiming } from "./timing";

describe("Overdue: days late is today minus the due date", () => {
  it("shows +3 days for an item due three days ago (Dijkstra on Thu 24 Sep)", () => {
    expect(daysLate("2026-09-21", "2026-09-24")).toBe(3);
  });

  it("shows +1 day for an item due yesterday", () => {
    expect(daysLate("2026-09-23", "2026-09-24")).toBe(1);
  });

  it("shows no delay for an item due today", () => {
    expect(daysLate("2026-09-24", "2026-09-24")).toBe(0);
  });

  it("shows no delay for an item due on a later day", () => {
    expect(daysLate("2026-09-25", "2026-09-24")).toBe(0);
  });
});

describe("Late and early reviews are marked against the date the item was due", () => {
  it("marks a review one day before the due date as 1 day early (Sat 12 Sep, due Sun 13)", () => {
    expect(reviewTiming({ reviewedOn: "2026-09-12", wasDueOn: "2026-09-13" })).toEqual({
      kind: "early",
      days: 1,
    });
  });

  it("marks a review after the due date as late (Wed 16 Sep, due Tue 15)", () => {
    expect(reviewTiming({ reviewedOn: "2026-09-16", wasDueOn: "2026-09-15" })).toEqual({
      kind: "late",
      days: 1,
    });
  });

  it("marks a review on the due date as on time", () => {
    expect(reviewTiming({ reviewedOn: "2026-09-07", wasDueOn: "2026-09-07" })).toEqual({
      kind: "on-time",
    });
  });
});
