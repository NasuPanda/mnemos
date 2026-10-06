import { addDays, compareDates, isIsoDate, type IsoDate } from "./dates";
import { gapFor, lastStop, type Ladder } from "./ladder";
import { ok, refuse, type Result } from "./result";

export type Confidence = "confident" | "neutral" | "not_at_all";

/** In button order: Confident, Neutral, Not at all (keys 1, 2, 3). */
export const CONFIDENCES: readonly Confidence[] = ["confident", "neutral", "not_at_all"];

/**
 * Ladder moves: Confident moves up one stop (staying on the last), Neutral keeps the stop, and
 * Not at all goes back to stop 1.
 */
export function moveOnLadder(stop: number, confidence: Confidence, ladder: Ladder): number {
  gapFor(ladder, stop);
  switch (confidence) {
    case "confident":
      return Math.min(stop + 1, lastStop(ladder));
    case "neutral":
      return stop;
    case "not_at_all":
      return 1;
  }
}

export type RatingOption = {
  confidence: Confidence;
  stopAfter: number;
  nextDueOn: IsoDate;
  /** Days from the review to the next due date: the gap of the stop it lands on. */
  gapDays: number;
};

/**
 * Where each rating leads from `stop` when rated on `day`: the date and stop shown on the
 * confidence buttons ("Thu 1 Oct · stop 5") and in the ladder preview.
 */
export function ratingOptions(stop: number, ladder: Ladder, day: IsoDate): RatingOption[] {
  return CONFIDENCES.map((confidence) => {
    const stopAfter = moveOnLadder(stop, confidence, ladder);
    const gapDays = gapFor(ladder, stopAfter);
    return { confidence, stopAfter, nextDueOn: addDays(day, gapDays), gapDays };
  });
}

/** New items start on stop 1 and are due the day they're added. */
export function newItemSchedule(today: IsoDate): { stop: number; dueOn: IsoDate } {
  if (!isIsoDate(today)) throw new RangeError(`Not a YYYY-MM-DD date: ${JSON.stringify(today)}`);
  return { stop: 1, dueOn: today };
}

/** One review, as stored in the reviews table. */
export type Review = {
  reviewedOn: IsoDate;
  confidence: Confidence;
  stopBefore: number;
  stopAfter: number;
  /** The due date the item had; with stopBefore it lets Undo restore the item. */
  wasDueOn: IsoDate;
  nextDueOn: IsoDate;
  /** True when the person picked the next date instead of using the ladder's gap. */
  manual: boolean;
};

export type RateInput = {
  item: { stop: number; dueOn: IsoDate };
  ladder: Ladder;
  today: IsoDate;
  confidence: Confidence;
  /** A date the person picked instead of the ladder's gap; it must be after today. */
  pickedDate?: IsoDate;
  /** Whether the item already has a review dated today. */
  reviewedToday: boolean;
};

export type RateRefusal =
  "already-reviewed-today" | "picked-date-invalid" | "picked-date-not-after-today";

/**
 * Rates an item on `today`, early, on time or late alike: the ladder moves, and the next due
 * date counts from today, unless the person picked a date, which replaces only the date. An
 * item can be reviewed at most once a day.
 */
export function rate(input: RateInput): Result<Review, RateRefusal> {
  const { item, ladder, today, confidence, pickedDate } = input;
  if (!isIsoDate(today)) throw new RangeError(`Not a YYYY-MM-DD date: ${JSON.stringify(today)}`);
  if (input.reviewedToday) return refuse("already-reviewed-today");

  const stopAfter = moveOnLadder(item.stop, confidence, ladder);
  let nextDueOn = addDays(today, gapFor(ladder, stopAfter));
  if (pickedDate !== undefined) {
    if (!isIsoDate(pickedDate)) return refuse("picked-date-invalid");
    if (compareDates(pickedDate, today) <= 0) return refuse("picked-date-not-after-today");
    nextDueOn = pickedDate;
  }

  return ok({
    reviewedOn: today,
    confidence,
    stopBefore: item.stop,
    stopAfter,
    wasDueOn: item.dueOn,
    nextDueOn,
    manual: pickedDate !== undefined,
  });
}

/** The item's stop and due date after a review. */
export function itemAfter(review: Review): { stop: number; dueOn: IsoDate } {
  return { stop: review.stopAfter, dueOn: review.nextDueOn };
}

/**
 * Undo: delete the review and put back the stop and due date the item had, so it can be rated
 * again today. Only a review made today can be undone.
 */
export function undo(
  review: Pick<Review, "reviewedOn" | "stopBefore" | "wasDueOn">,
  today: IsoDate,
): Result<{ stop: number; dueOn: IsoDate }, "not-from-today"> {
  if (review.reviewedOn !== today) return refuse("not-from-today");
  return ok({ stop: review.stopBefore, dueOn: review.wasDueOn });
}
