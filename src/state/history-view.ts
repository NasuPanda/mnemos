import { daysLate, reviewTiming, type Confidence, type IsoDate, type Ladder } from "@/core";
import { count, shortDate } from "@/lib/format";
import type { ItemHistoryResponse, ReviewDto } from "../../worker/contract";

/** Dot sizes in px: bigger is more confident (page 20: 16, 12, 8). */
export const DOT_SIZE: Record<Confidence, number> = { confident: 16, neutral: 12, not_at_all: 8 };

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  confident: "Confident",
  neutral: "Neutral",
  not_at_all: "Not at all",
};

/** One review on the line map: x is its place in order, y the stop it landed on. */
export type HistoryPoint = {
  review: ReviewDto;
  /** Oldest first, from 0. */
  index: number;
  stop: number;
  size: number;
  /** Days early, for the ⏩ "1 day early" mark; null when on time or late. */
  early: number | null;
  /** The next date was picked: the calendar "picked" mark. */
  picked: boolean;
  /** "Sat 12 Sep · Confident · 1 day early" */
  title: string;
  /** "up to stop 3 · next Tue 15 Sep" */
  detail: string;
};

export type HistoryView = {
  /** Oldest first, as the line map draws them. */
  points: HistoryPoint[];
  /** Newest first, as the table lists them. */
  rows: HistoryPoint[];
  /**
   * The line map's height in stops: the ladder, stretched if an older review sits higher (stops
   * are kept as they were when reviewed, even after a stop was removed).
   */
  stops: number;
  now: {
    stop: number;
    /** The day of the review that put it on this stop, if it still is where that left it. */
    since: IsoDate | null;
    dueOn: IsoDate;
    daysLate: number;
  };
};

/** The history of one item for its line map and table. */
export function historyView(
  history: ItemHistoryResponse,
  ladder: Ladder,
  today: IsoDate,
): HistoryView {
  const oldestFirst = [...history.reviews].reverse();
  const points = oldestFirst.map((review, index) => point(review, index));
  const latest = history.reviews[0];
  const { item } = history;
  return {
    points,
    rows: [...points].reverse(),
    stops: Math.max(ladder.length, item.stop, ...points.map((p) => p.stop)),
    now: {
      stop: item.stop,
      since:
        latest && latest.stopAfter === item.stop && latest.nextDueOn === item.dueOn
          ? latest.reviewedOn
          : null,
      dueOn: item.dueOn,
      daysLate: daysLate(item.dueOn, today),
    },
  };
}

function point(review: ReviewDto, index: number): HistoryPoint {
  const timing = reviewTiming(review);
  const early = timing.kind === "early" ? timing.days : null;
  const title = [
    shortDate(review.reviewedOn),
    CONFIDENCE_LABEL[review.confidence],
    ...(early ? [`${count(early, "day")} early`] : []),
  ].join(" · ");
  const next = `next ${shortDate(review.nextDueOn)}${review.manual ? " (picked)" : ""}`;
  return {
    review,
    index,
    stop: review.stopAfter,
    size: DOT_SIZE[review.confidence],
    early,
    picked: review.manual,
    title,
    detail: `${move(review)} · ${next}`,
  };
}

/** "up to stop 3", "stays on stop 4", "back to stop 1". */
export function move(review: Pick<ReviewDto, "stopBefore" | "stopAfter">): string {
  if (review.stopAfter > review.stopBefore) return `up to stop ${review.stopAfter}`;
  if (review.stopAfter === review.stopBefore) return `stays on stop ${review.stopAfter}`;
  return `back to stop ${review.stopAfter}`;
}

/** "3 Sep" under a dot on desktop. */
export function axisDate(date: IsoDate): string {
  return shortDate(date).split(" ").slice(1).join(" ");
}

/** "3" under a dot on the phone. */
export function axisDay(date: IsoDate): string {
  return String(Number(date.slice(8)));
}
