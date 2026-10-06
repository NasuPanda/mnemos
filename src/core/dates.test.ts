import { describe, expect, it } from "vitest";
import { addDays, compareDates, daysBetween, isIsoDate } from "./dates";

describe("Dates are plain YYYY-MM-DD strings", () => {
  it("accepts real calendar dates", () => {
    expect(isIsoDate("2026-09-24")).toBe(true);
    expect(isIsoDate("2028-02-29")).toBe(true);
  });

  it("rejects dates that don't exist", () => {
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2026-13-01")).toBe(false);
    expect(isIsoDate("2027-02-29")).toBe(false);
  });

  it("rejects anything that isn't exactly YYYY-MM-DD", () => {
    for (const value of ["2026-9-24", "24/09/2026", "2026-09-24T00:00:00Z", "", "0999-01-01"]) {
      expect(isIsoDate(value), value).toBe(false);
    }
    expect(isIsoDate(20260924)).toBe(false);
    expect(isIsoDate(null)).toBe(false);
  });
});

describe("Date arithmetic counts whole calendar days", () => {
  it("adds days across month and year ends", () => {
    expect(addDays("2026-09-24", 7)).toBe("2026-10-01");
    expect(addDays("2026-09-24", 28)).toBe("2026-10-22");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("goes back with negative days", () => {
    expect(addDays("2026-09-01", -1)).toBe("2026-08-31");
  });

  it("is unaffected by daylight saving changes", () => {
    // Europe/Budapest moves the clocks on 25 Oct 2026 and 28 Mar 2027.
    expect(addDays("2026-10-24", 2)).toBe("2026-10-26");
    expect(daysBetween("2027-03-27", "2027-03-29")).toBe(2);
  });

  it("measures the days between two dates, positive when the second is later", () => {
    expect(daysBetween("2026-09-21", "2026-09-24")).toBe(3);
    expect(daysBetween("2026-09-24", "2026-09-21")).toBe(-3);
    expect(daysBetween("2026-09-24", "2026-09-24")).toBe(0);
  });

  it("orders dates from earliest to latest", () => {
    const dates = ["2026-10-01", "2026-09-24", "2027-01-01", "2026-09-25"];
    expect([...dates].sort(compareDates)).toEqual([
      "2026-09-24",
      "2026-09-25",
      "2026-10-01",
      "2027-01-01",
    ]);
  });

  it("refuses invalid dates and fractional days instead of guessing", () => {
    expect(() => addDays("2026-02-30", 1)).toThrow(RangeError);
    expect(() => addDays("2026-09-24", 1.5)).toThrow(RangeError);
    expect(() => daysBetween("yesterday", "2026-09-24")).toThrow(RangeError);
  });
});
