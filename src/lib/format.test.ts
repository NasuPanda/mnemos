import { describe, expect, it } from "vitest";
import { keyName } from "@/hooks/use-hotkeys";
import {
  count,
  dayMonth,
  lateLabel,
  longDate,
  relativeDay,
  shortDate,
  shortUrl,
  stripDate,
  weekday,
} from "./format";
import { localToday } from "./today";

describe("Dates as the mockups write them", () => {
  it("names the week strip's days: Mon 21", () => {
    expect(stripDate("2026-09-21")).toEqual({ weekday: "Mon", day: 21 });
    expect(stripDate("2026-09-27")).toEqual({ weekday: "Sun", day: 27 });
  });

  it("says Today, Tomorrow or Yesterday under the heading, and nothing for other days", () => {
    expect(relativeDay("2026-09-24", "2026-09-24")).toBe("Today");
    expect(relativeDay("2026-09-25", "2026-09-24")).toBe("Tomorrow");
    expect(relativeDay("2026-09-23", "2026-09-24")).toBe("Yesterday");
    expect(relativeDay("2026-09-26", "2026-09-24")).toBeNull();
    expect(relativeDay("2026-09-21", "2026-09-24")).toBeNull();
  });

  it("writes the confidence buttons' dates short: Thu 1 Oct", () => {
    expect(shortDate("2026-10-01")).toBe("Thu 1 Oct");
    expect(shortDate("2026-09-29")).toBe("Tue 29 Sep");
  });

  it("writes the dashboard heading long: Thursday 24 September", () => {
    expect(longDate("2026-09-24")).toBe("Thursday 24 September");
    expect(weekday("2026-09-24")).toBe("Thursday");
    expect(dayMonth("2026-09-24")).toBe("24 September");
  });

  it("never shifts a date by a day, whatever the time zone", () => {
    expect(shortDate("2026-12-31")).toBe("Thu 31 Dec");
    expect(shortDate("2027-01-01")).toBe("Fri 1 Jan");
  });

  it("writes the overdue marker as +1 day or +3 days", () => {
    expect(lateLabel(1)).toBe("+1 day");
    expect(lateLabel(3)).toBe("+3 days");
  });

  it("counts with the right plural", () => {
    expect(count(1, "item")).toBe("1 item");
    expect(count(38, "item")).toBe("38 items");
  });
});

describe("Today is the browser's local date", () => {
  it("uses the local calendar date, not UTC", () => {
    // 00:30 local time on 25 Sep is still 24 Sep in UTC west of Greenwich, and vice versa.
    expect(localToday(new Date(2026, 8, 25, 0, 30))).toBe("2026-09-25");
    expect(localToday(new Date(2026, 8, 24, 23, 59))).toBe("2026-09-24");
  });
});

describe("Key names", () => {
  it("names keys as the shortcut list writes them", () => {
    expect(keyName({ key: " ", shiftKey: false })).toBe("Space");
    expect(keyName({ key: "j", shiftKey: false })).toBe("j");
    expect(keyName({ key: "J", shiftKey: false })).toBe("j");
    expect(keyName({ key: "F", shiftKey: true })).toBe("Shift+F");
    expect(keyName({ key: "Enter", shiftKey: false })).toBe("Enter");
    expect(keyName({ key: "1", shiftKey: false })).toBe("1");
  });
});

describe("Links", () => {
  it("show their address without the scheme", () => {
    expect(shortUrl("https://example.edu/algo/lecture-07.pdf")).toBe(
      "example.edu/algo/lecture-07.pdf",
    );
    expect(shortUrl("http://example.edu/")).toBe("example.edu");
  });
});
