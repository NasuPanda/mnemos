import { describe, expect, it } from "vitest";
import { editItemPath, matchRoute, newItemPath } from "./routes";

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
});
