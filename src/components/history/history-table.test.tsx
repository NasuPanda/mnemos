import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ReviewDto } from "../../../worker/contract";
import { historyView } from "@/state/history-view";
import { HistoryTable } from "./history-table";

const review = (
  id: number,
  reviewedOn: string,
  confidence: ReviewDto["confidence"],
  stops: [number, number],
  wasDueOn: string,
  nextDueOn: string,
  manual = false,
): ReviewDto => ({
  id,
  itemId: 1,
  reviewedOn,
  confidence,
  stopBefore: stops[0],
  stopAfter: stops[1],
  wasDueOn,
  nextDueOn,
  manual,
});

const view = historyView(
  {
    item: { id: 1, sectionId: 1, name: "Dijkstra", stop: 3, dueOn: "2026-09-15" },
    reviews: [
      review(3, "2026-09-12", "confident", [2, 3], "2026-09-13", "2026-09-15"),
      review(2, "2026-09-10", "not_at_all", [3, 1], "2026-09-10", "2026-09-11"),
      review(1, "2026-09-04", "confident", [1, 2], "2026-09-04", "2026-09-07", true),
    ],
  },
  [1, 2, 3, 5, 7, 14, 28],
  "2026-09-24",
);

const html = (compact = false) =>
  renderToStaticMarkup(
    <HistoryTable rows={view.rows} stops={7} compact={compact} active={null} onActive={() => {}} />,
  );

describe("The history table (page 20)", () => {
  it("lists every review newest first, with its confidence and the stop it moved to", () => {
    const text = html().replace(/<[^>]+>/g, " ");
    expect(text.indexOf("Sat 12 Sep")).toBeLessThan(text.indexOf("Thu 10 Sep"));
    expect(text.indexOf("Thu 10 Sep")).toBeLessThan(text.indexOf("Fri 4 Sep"));
    expect(text).toContain("Not at all");
    expect(html()).toContain('aria-label="Stop 3 of 7"');
  });

  it("puts the marks in words: 1 day early by the review date, picked by the date it set", () => {
    const text = html()
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ");
    expect(text).toContain("Sat 12 Sep 1 day early");
    expect(text).toContain("Mon 7 Sep picked");
  });

  it("calls the column Stop on the phone", () => {
    expect(html(true)).toContain(">Stop<");
    expect(html()).toContain(">Stop after<");
  });
});
