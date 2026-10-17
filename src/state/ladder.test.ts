import { describe, expect, it } from "vitest";
import { DEFAULT_LADDER } from "@/core";
import { checkGapDraft, gapMessage, parseGap } from "./ladder";

describe("Ladder editor › a gap being typed (page 20)", () => {
  it("reads whole numbers of days only", () => {
    expect(parseGap("6")).toBe(6);
    expect(parseGap(" 14 ")).toBe(14);
    expect(parseGap("")).toBeNaN();
    expect(parseGap("2.5")).toBeNaN();
    expect(parseGap("-1")).toBeNaN();
    expect(parseGap("1e2")).toBeNaN();
  });

  it("accepts stop 4 at 6 days, between stop 3 (3 days) and stop 5 (7 days)", () => {
    expect(checkGapDraft(DEFAULT_LADDER, 4, "6")).toEqual({ gap: 6, message: null, changed: true });
  });

  it("has nothing to save when the gap is what it was", () => {
    expect(checkGapDraft(DEFAULT_LADDER, 4, "5").changed).toBe(false);
  });

  it("says what to fix, in the draft's words", () => {
    expect(checkGapDraft(DEFAULT_LADDER, 1, "0").message).toBe("Use a whole number from 1 to 365.");
    expect(checkGapDraft(DEFAULT_LADDER, 1, "").message).toBe("Use a whole number from 1 to 365.");
    expect(checkGapDraft(DEFAULT_LADDER, 5, "4").message).toBe(
      "Make it longer than stop 4 (5 days).",
    );
    expect(checkGapDraft(DEFAULT_LADDER, 3, "9").message).toBe(
      "Make it shorter than stop 4 (5 days).",
    );
  });

  it("says day, not days, for a one-day stop", () => {
    expect(gapMessage({ kind: "gap-not-longer", previous: { stop: 1, gap: 1 } })).toBe(
      "Make it longer than stop 1 (1 day).",
    );
  });
});
