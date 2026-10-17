import { describe, expect, it } from "vitest";
import plan from "../../docs/design-plan.md?raw";
import { modKey, SHORTCUTS } from "./keys";

describe("modKey", () => {
  it("shows ⌘ on Macs, iPhones and iPads", () => {
    expect(modKey("macOS")).toBe("⌘");
    expect(modKey("MacIntel")).toBe("⌘");
    expect(modKey("iPhone")).toBe("⌘");
    expect(modKey("iPad")).toBe("⌘");
  });

  it("shows Ctrl everywhere else", () => {
    expect(modKey("Win32")).toBe("Ctrl");
    expect(modKey("Windows")).toBe("Ctrl");
    expect(modKey("Linux x86_64")).toBe("Ctrl");
    expect(modKey("")).toBe("Ctrl");
  });
});

/** The plan's Keyboard shortcuts table: each row's keys and the places it names. */
function planRows() {
  const section = plan.split("## Keyboard shortcuts")[1]!.split("\n## ")[0]!;
  return section
    .split("\n")
    .filter((line) => line.startsWith("| ") && !line.startsWith("| Key ") && !/^\| -/.test(line))
    .map((line) => {
      const [key, where] = line.split(" | ").map((cell) => cell.replace(/^\| /, "").trim());
      return {
        keys: key!.split(" / ").flatMap((part) => part.split("+")),
        where: where!.split(", ").map((place) => PLACES[place.toLowerCase()]),
      };
    });
}

const PLACES: Record<string, string> = {
  dashboard: "Dashboard",
  review: "Review",
  items: "Items",
  "item editor": "Item editor",
  settings: "Settings",
  anywhere: "Everywhere",
};

describe("the shortcuts overlay", () => {
  it("lists every key of the plan's shortcut table, in the places the plan names", () => {
    const rows = planRows();
    expect(rows.length).toBeGreaterThan(20);
    for (const row of rows) {
      for (const where of row.where) {
        const group = SHORTCUTS.find((g) => g.where === where);
        expect(group, `group ${where}`).toBeDefined();
        const keys = group!.shortcuts.flatMap((shortcut) => shortcut.keys);
        for (const key of row.keys) expect(keys, `${key} in ${where}`).toContain(key);
      }
    }
  });
});
