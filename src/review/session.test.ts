import { describe, expect, it } from "vitest";
import {
  advance,
  currentItem,
  isFinished,
  pickDate,
  progress,
  returnTo,
  reveal,
  runFromTarget,
  runKey,
  runQueue,
  startSession,
  toggleAnswer,
} from "./session";

const all = () => startSession({ kind: "all" }, [11, 12, 13]);
const everythingLeft = () => true;

describe("A review run", () => {
  it("starts on the first item, problem side, with no picked date", () => {
    const session = all();
    expect(currentItem(session)).toBe(11);
    expect(session.revealed).toBe(false);
    expect(session.pickedDate).toBeNull();
    expect(progress(session)).toEqual({ number: 1, total: 3 });
  });

  it("shows and hides the answer with Space or a tap", () => {
    const shown = toggleAnswer(all());
    expect(shown.revealed).toBe(true);
    expect(toggleAnswer(shown).revealed).toBe(false);
    expect(reveal(shown)).toBe(shown);
  });

  it("moves on after a rating: next item, problem side, picked date cleared", () => {
    const rated = advance(pickDate(reveal(all()), "2026-10-05"), everythingLeft);
    expect(currentItem(rated)).toBe(12);
    expect(rated.revealed).toBe(false);
    expect(rated.pickedDate).toBeNull();
    expect(progress(rated)).toEqual({ number: 2, total: 3 });
  });

  it("keeps its count while items are rated: the queue is fixed when it starts", () => {
    const second = advance(all(), everythingLeft);
    expect(progress(second).total).toBe(3);
  });

  it("skips items that were rated meanwhile, for example in another tab", () => {
    const next = advance(all(), (id) => id !== 12);
    expect(currentItem(next)).toBe(13);
  });

  it("finishes after the last item", () => {
    let session = all();
    for (let i = 0; i < 3; i++) session = advance(session, everythingLeft);
    expect(isFinished(session)).toBe(true);
    expect(currentItem(session)).toBeNull();
    expect(progress(session)).toEqual({ number: 3, total: 3 });
  });

  it("goes back to the undone item, answer showing, ready to rate again", () => {
    const later = advance(advance(all(), everythingLeft), everythingLeft);
    const undone = returnTo(later, 12);
    expect(currentItem(undone)).toBe(12);
    expect(undone.revealed).toBe(true);
  });

  it("comes back from All done when the last rating is undone", () => {
    let session = all();
    for (let i = 0; i < 3; i++) session = advance(session, everythingLeft);
    const undone = returnTo(session, 13);
    expect(isFinished(undone)).toBe(false);
    expect(currentItem(undone)).toBe(13);
  });

  it("runs a single item opened from the dashboard", () => {
    const one = startSession({ kind: "item", itemId: 42 }, [42]);
    expect(progress(one)).toEqual({ number: 1, total: 1 });
    expect(isFinished(advance(one, everythingLeft))).toBe(true);
  });
});

describe("Runs for today and for Review early", () => {
  const TODAY = "2026-09-24";
  const FRIDAY = "2026-09-25";
  const sections = [
    { id: 1, position: 1 },
    { id: 2, position: 2 },
  ];

  it("reads a run from its address; a day that isn't ahead means today", () => {
    expect(runFromTarget({}, TODAY)).toEqual({ kind: "all" });
    expect(runFromTarget({ day: FRIDAY, sectionId: 2 }, TODAY)).toEqual({
      kind: "section",
      sectionId: 2,
      day: FRIDAY,
    });
    expect(runFromTarget({ day: TODAY, itemId: 5 }, TODAY)).toEqual({ kind: "item", itemId: 5 });
    expect(runFromTarget({ day: "2026-09-20" }, TODAY)).toEqual({ kind: "all" });
  });

  it("tells today's runs from a day's", () => {
    expect(runKey({ kind: "all" })).toBe("all");
    expect(runKey({ kind: "all", day: FRIDAY })).toBe("2026-09-25-all");
    expect(runKey({ kind: "item", itemId: 5, day: FRIDAY })).toBe("2026-09-25-item-5");
  });

  it("reviews Friday early: its items not reviewed today, in dashboard order", () => {
    const friday = [
      { id: 3, sectionId: 2, dueOn: FRIDAY },
      { id: 1, sectionId: 1, dueOn: FRIDAY },
      { id: 2, sectionId: 1, dueOn: FRIDAY },
    ];
    const options = { sections, reviewedToday: new Set([2]), today: TODAY };
    expect(runQueue({ kind: "all", day: FRIDAY }, friday, options)).toEqual([1, 3]);
    expect(runQueue({ kind: "section", sectionId: 2, day: FRIDAY }, friday, options)).toEqual([3]);
    expect(runQueue({ kind: "item", itemId: 2, day: FRIDAY }, friday, options)).toEqual([]);
    expect(runQueue({ kind: "item", itemId: 1, day: FRIDAY }, friday, options)).toEqual([1]);
  });

  it("reviews today's Left items when there is no day", () => {
    const left = [
      { id: 7, sectionId: 1, dueOn: TODAY },
      { id: 6, sectionId: 1, dueOn: "2026-09-21" },
    ];
    const options = { sections, reviewedToday: new Set<number>(), today: TODAY };
    expect(runQueue({ kind: "all" }, left, options)).toEqual([6, 7]);
  });
});
