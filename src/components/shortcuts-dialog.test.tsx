import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SHORTCUTS } from "@/lib/keys";
import { ShortcutList } from "./shortcuts-dialog";

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("the shortcut list", () => {
  it("shows every group, in the plan's order", () => {
    const html = renderToStaticMarkup(<ShortcutList groups={SHORTCUTS} mod="Ctrl" />);
    const headings = [...html.matchAll(/<h3[^>]*>([^<]+)<\/h3>/g)].map((m) => m[1]);
    expect(headings).toEqual([
      "Dashboard",
      "Review",
      "Items",
      "Item editor",
      "Settings",
      "Everywhere",
    ]);
  });

  it("shows ⌘ in place of Ctrl on a Mac", () => {
    const mac = text(renderToStaticMarkup(<ShortcutList groups={SHORTCUTS} mod="⌘" />));
    expect(mac).toContain("⌘ K Command menu");
    expect(mac).toContain("⌘ Enter Save");
    expect(mac).not.toContain("Ctrl");
  });

  it("pairs each key with what it does", () => {
    const html = text(renderToStaticMarkup(<ShortcutList groups={SHORTCUTS} mod="Ctrl" />));
    expect(html).toContain("Shift F Review the selected line");
    expect(html).toContain("1 2 3 Confident, Neutral, Not at all");
    expect(html).toContain("? All shortcuts");
  });
});
