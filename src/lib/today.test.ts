import { afterEach, describe, expect, it } from "vitest";
import { currentToday, localToday, pinToday } from "./today";

const evening = new Date(2026, 10, 10, 23, 59);
const pastMidnight = new Date(2026, 10, 11, 0, 5);

describe("today", () => {
  afterEach(() => pinToday(null));

  it("is the browser's local date", () => {
    expect(localToday(evening)).toBe("2026-11-10");
    expect(currentToday(pastMidnight)).toBe("2026-11-11");
  });

  it("stays on the practice day's date past midnight while pinned", () => {
    pinToday("2026-11-10");
    expect(currentToday(pastMidnight)).toBe("2026-11-10");
  });

  it("follows the clock again once unpinned", () => {
    pinToday("2026-11-10");
    pinToday(null);
    expect(currentToday(pastMidnight)).toBe("2026-11-11");
  });
});
