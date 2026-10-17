import { describe, expect, it } from "vitest";
import {
  dayFromQuery,
  dayPath,
  editItemPath,
  flashPath,
  matchRoute,
  newItemPath,
  reviewPath,
  runTargetFromQuery,
} from "./routes";

const TODAY = "2026-09-24";
const query = (search: string) => new URLSearchParams(search);

describe("routes", () => {
  it("knows each screen's path", () => {
    expect(matchRoute("/")).toEqual({ screen: "today" });
    expect(matchRoute("/items")).toEqual({ screen: "items" });
    expect(matchRoute("/items/new")).toEqual({ screen: "new-item" });
    expect(matchRoute("/settings")).toEqual({ screen: "settings" });
  });

  it("opens the editor for /items/<id>", () => {
    expect(matchRoute(editItemPath(42))).toEqual({ screen: "edit-item", itemId: 42 });
  });

  it("treats anything else as unknown", () => {
    for (const path of ["/items/0", "/items/abc", "/items/1/x", "/item", "/items/"]) {
      expect(matchRoute(path), path).toEqual({ screen: "unknown" });
    }
  });

  it("can start a new item in a line", () => {
    expect(newItemPath()).toBe("/items/new");
    expect(newItemPath(3)).toBe("/items/new?section=3");
  });

  it("shows another day at /?day=YYYY-MM-DD, and today at plain /", () => {
    expect(dayPath("2026-09-25", TODAY)).toBe("/?day=2026-09-25");
    expect(dayPath("2026-09-21", TODAY)).toBe("/?day=2026-09-21");
    expect(dayPath(TODAY, TODAY)).toBe("/");
  });

  it("reads the day from the address, falling back to today", () => {
    expect(dayFromQuery(query("day=2026-09-25"), TODAY)).toBe("2026-09-25");
    expect(dayFromQuery(query(""), TODAY)).toBe(TODAY);
    expect(dayFromQuery(query("day=2026-02-30"), TODAY)).toBe(TODAY);
    expect(dayFromQuery(query("day=tomorrow"), TODAY)).toBe(TODAY);
  });

  it("starts a run for today, a line, an item, or a day to review early", () => {
    expect(flashPath()).toBe("/flash");
    expect(flashPath({ sectionId: 3 })).toBe("/flash?section=3");
    expect(flashPath({ day: "2026-09-25" })).toBe("/flash?day=2026-09-25");
    expect(reviewPath({ day: "2026-09-25", sectionId: 3 })).toBe(
      "/review?day=2026-09-25&section=3",
    );
    expect(reviewPath({ itemId: 5 })).toBe("/review?item=5");
    expect(reviewPath({ day: null, itemId: 5 })).toBe("/review?item=5");
  });

  it("reads a run back from its address", () => {
    expect(runTargetFromQuery(query(""))).toEqual({});
    expect(runTargetFromQuery(query("section=3"))).toEqual({ sectionId: 3 });
    expect(runTargetFromQuery(query("day=2026-09-25&item=5"))).toEqual({
      day: "2026-09-25",
      itemId: 5,
    });
    expect(runTargetFromQuery(query("day=nope&section=0"))).toEqual({});
  });
});
