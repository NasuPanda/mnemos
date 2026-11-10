import { describe, expect, it } from "vitest";
import { baseOf, stripBase, withBase } from "./router";
import { matchRoute } from "./routes";

describe("the practice day's base", () => {
  it("is /tutorial and everything under it, nothing else", () => {
    expect(baseOf("/tutorial")).toBe("/tutorial");
    expect(baseOf("/tutorial/")).toBe("/tutorial");
    expect(baseOf("/tutorial/items/new")).toBe("/tutorial");
    expect(baseOf("/")).toBe("");
    expect(baseOf("/items")).toBe("");
    expect(baseOf("/tutorials")).toBe("");
  });

  it("is added to the app's paths, the dashboard being the base itself", () => {
    expect(withBase("/", "/tutorial")).toBe("/tutorial");
    expect(withBase("/?day=2026-11-12", "/tutorial")).toBe("/tutorial?day=2026-11-12");
    expect(withBase("/items/new?section=1", "/tutorial")).toBe("/tutorial/items/new?section=1");
    expect(withBase("/settings#lines", "/tutorial")).toBe("/tutorial/settings#lines");
    expect(withBase("/flash", "")).toBe("/flash");
  });

  it("is taken off again, so the screens see the app's own paths", () => {
    for (const path of ["/", "/flash", "/items/new", "/items/12", "/settings"]) {
      const full = withBase(path, "/tutorial").split(/[?#]/)[0]!;
      expect(stripBase(full, baseOf(full)), path).toBe(path);
    }
    expect(stripBase("/tutorial/", "/tutorial")).toBe("/");
    expect(matchRoute(stripBase("/tutorial/items/3", "/tutorial"))).toEqual({
      screen: "edit-item",
      itemId: 3,
    });
    expect(stripBase("/items", "")).toBe("/items");
  });
});
