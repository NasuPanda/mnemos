import { describe, expect, it } from "vitest";
import { advance, hasBack, paused, screenOf, type TourEvent } from "./tour";
import { copyParts, touchCopy, tourSteps, type Layout } from "./tour-steps";

/** Walks the tour with `events` and returns the step index after each. */
function walk(layout: Layout, events: TourEvent[]): number[] {
  let index = 0;
  return events.map((event) => (index = advance(index, event, layout)));
}

const arrive = (s: "dashboard" | "items" | "editor" | "flash" | "review" | "all-done") =>
  ({ type: "screen", screen: s }) as const;

describe("the tour's steps", () => {
  it("has 12 steps on desktop and 14 on the phone, which goes through Items", () => {
    expect(tourSteps("desktop")).toHaveLength(12);
    const phone = tourSteps("phone");
    expect(phone).toHaveLength(14);
    expect(phone.map((step) => step.screen)).toEqual([
      "dashboard",
      "dashboard",
      "dashboard",
      "items",
      "editor",
      "editor",
      "editor",
      "editor",
      "items",
      "dashboard",
      "flash",
      "review",
      "review",
      "all-done",
    ]);
  });

  it("ends on the closing card, and every Act step says Your turn! but the rating", () => {
    for (const layout of ["phone", "desktop"] as const) {
      const steps = tourSteps(layout);
      expect(steps.at(-1)?.kind).toBe("closing");
      for (const step of steps.filter((s) => s.kind === "act" && s.id !== "rate")) {
        expect(step.subtext, `${layout} ${step.id}`).toBe("Your turn!");
      }
    }
  });

  it("runs from welcome to the closing card on desktop", () => {
    const events: TourEvent[] = [
      { type: "next" },
      { type: "next" },
      arrive("editor"),
      { type: "next" },
      { type: "next" },
      { type: "next" },
      { type: "created" },
      arrive("flash"),
      arrive("review"),
      { type: "revealed" },
      { type: "rated" },
      { type: "finish" },
    ];
    expect(walk("desktop", events)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it("runs through Items on the phone", () => {
    const events: TourEvent[] = [
      { type: "next" },
      { type: "next" },
      arrive("items"),
      arrive("editor"),
      { type: "next" },
      { type: "next" },
      { type: "next" },
      { type: "created" },
      arrive("dashboard"),
      arrive("flash"),
      arrive("review"),
      { type: "revealed" },
      { type: "rated" },
      { type: "finish" },
    ];
    expect(walk("phone", events)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
  });

  it("moves on only from what ends the step", () => {
    // Next does nothing on an Act step; arriving on another screen than the step's end neither.
    expect(advance(2, { type: "next" }, "desktop")).toBe(2);
    expect(advance(2, arrive("items"), "desktop")).toBe(2);
    expect(advance(6, arrive("dashboard"), "desktop")).toBe(6);
    expect(advance(0, { type: "rated" }, "desktop")).toBe(0);
  });

  it("goes Back only to the previous Explain step on the same screen", () => {
    expect(hasBack(0, "desktop")).toBe(false);
    expect(hasBack(1, "desktop")).toBe(true);
    expect(advance(1, { type: "back" }, "desktop")).toBe(0);
    // The editor's first Explain step comes after an Act step: no Back.
    expect(hasBack(3, "desktop")).toBe(false);
    expect(hasBack(4, "desktop")).toBe(true);
    expect(hasBack(5, "desktop")).toBe(true);
    expect(advance(2, { type: "back" }, "desktop")).toBe(2);
  });

  it("waits off its screen and under a dialog or sheet", () => {
    const [welcome] = tourSteps("phone");
    expect(paused(welcome!, "dashboard", false)).toBe(false);
    expect(paused(welcome!, "settings" as never, false)).toBe(true);
    expect(paused(welcome!, null, false)).toBe(true);
    expect(paused(welcome!, "dashboard", true)).toBe(true);
  });

  it("knows the screen from the address", () => {
    expect(screenOf("/", false)).toBe("dashboard");
    expect(screenOf("/", true)).toBe("all-done");
    expect(screenOf("/items/new", false)).toBe("editor");
    expect(screenOf("/items/3", false)).toBeNull();
    expect(screenOf("/settings", false)).toBeNull();
  });
});

describe("the tour's copy", () => {
  it("turns [keys] into chips, one per key", () => {
    expect(copyParts("Save it [Ctrl Enter]")).toEqual([
      { text: "Save it " },
      { key: "Ctrl" },
      { key: "Enter" },
    ]);
    expect(copyParts("from [?] or the menu")).toEqual([
      { text: "from " },
      { key: "?" },
      { text: " or the menu" },
    ]);
  });

  it("leaves the chips at the end of a sentence out on touch screens, and keeps the rest as words", () => {
    expect(touchCopy("Save it [Ctrl Enter]")).toBe("Save it");
    expect(touchCopy("Start when you’re ready [Enter]")).toBe("Start when you’re ready");
    expect(touchCopy("or press [Space] to see it.")).toBe("or press Space to see it.");
    expect(touchCopy("from [?] or the command menu [Ctrl K]")).toBe("from ? or the command menu");
  });
});
