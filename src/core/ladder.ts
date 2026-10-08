import { ok, refuse, type Result } from "./result";

/**
 * The ladder: the gap in days for each stop, from stop 1 upwards. Stop n uses `ladder[n - 1]`;
 * the last stop is the Végállomás ("end of the line").
 */
export type Ladder = readonly number[];

export const MAX_STOPS = 7;
export const MIN_GAP = 1;
export const MAX_GAP = 365;
export const DEFAULT_LADDER: Ladder = [1, 2, 3, 5, 7, 14, 28];

/** The number of the last stop. */
export function lastStop(ladder: Ladder): number {
  return ladder.length;
}

/** The gap in days of a stop. */
export function gapFor(ladder: Ladder, stop: number): number {
  const gap = ladder[stop - 1];
  if (!Number.isInteger(stop) || gap === undefined) {
    throw new RangeError(`Stop ${stop} is not on a ladder of ${ladder.length} stops`);
  }
  return gap;
}

export type LadderIssue =
  | { kind: "no-stops" }
  | { kind: "too-many-stops"; max: number }
  /** "Use a whole number from 1 to 365." */
  | { kind: "gap-out-of-range"; stop: number; min: number; max: number }
  /** "Make it longer than stop 4 (5 days)." */
  | { kind: "gap-not-longer"; stop: number; previous: { stop: number; gap: number } };

/**
 * Checks a ladder: 1 to 7 stops, each gap a whole number of days from 1 to 365, and each gap
 * longer than the one before. Problems are reported at the stop that has them, so the editor
 * can show the message under that stop. An empty list means the ladder is valid.
 */
export function validateLadder(gaps: readonly number[]): LadderIssue[] {
  const issues: LadderIssue[] = [];
  if (gaps.length === 0) issues.push({ kind: "no-stops" });
  if (gaps.length > MAX_STOPS) issues.push({ kind: "too-many-stops", max: MAX_STOPS });

  gaps.forEach((gap, index) => {
    const stop = index + 1;
    if (!isGapInRange(gap)) {
      issues.push({ kind: "gap-out-of-range", stop, min: MIN_GAP, max: MAX_GAP });
      return;
    }
    const previous = gaps[index - 1];
    // Compare only with a usable previous gap; a broken one already has its own message.
    if (previous !== undefined && isGapInRange(previous) && gap <= previous) {
      issues.push({ kind: "gap-not-longer", stop, previous: { stop: stop - 1, gap: previous } });
    }
  });
  return issues;
}

function isGapInRange(gap: number): boolean {
  return Number.isInteger(gap) && gap >= MIN_GAP && gap <= MAX_GAP;
}

/** The ladder with one stop's gap changed. Check the result with `validateLadder`. */
export function setGap(ladder: Ladder, stop: number, gap: number): Ladder {
  gapFor(ladder, stop);
  return ladder.map((current, index) => (index === stop - 1 ? gap : current));
}

export type AddStopRefusal = "max-stops" | "last-gap-at-max";

/**
 * Why "Add stop" is unavailable, or null when a stop can be added: a ladder has at most 7
 * stops, and the new last stop must be longer than the current last one, so none fits after 365.
 */
export function addStopRefusal(ladder: Ladder): AddStopRefusal | null {
  if (ladder.length >= MAX_STOPS) return "max-stops";
  if (gapFor(ladder, lastStop(ladder)) >= MAX_GAP) return "last-gap-at-max";
  return null;
}

/** The gap a new last stop starts with: double the current last gap, capped at 365. */
export function newStopGap(ladder: Ladder): number {
  return Math.min(gapFor(ladder, lastStop(ladder)) * 2, MAX_GAP);
}

/** Adds a new last stop, starting at `newStopGap`; the person can edit the gap afterwards. */
export function addStop(ladder: Ladder): Result<Ladder, AddStopRefusal> {
  const refusal = addStopRefusal(ladder);
  return refusal ? refuse(refusal) : ok([...ladder, newStopGap(ladder)]);
}

/**
 * Removes stop `removed`. Items are remapped with `stopAfterRemoval`; their due dates stay as
 * they are. A ladder always keeps at least one stop.
 */
export function removeStop(ladder: Ladder, removed: number): Result<Ladder, "last-stop"> {
  gapFor(ladder, removed);
  if (ladder.length === 1) return refuse("last-stop");
  return ok(ladder.filter((_, index) => index !== removed - 1));
}

/**
 * Where an item on `stop` lands after stop `removed` is taken out: the removed stop's items move
 * down one stop (stop 1's items stay on the new stop 1), and the stops after it renumber down by
 * one. In SQL: `stop = stop − 1` where `stop ≥ max(removed, 2)`.
 */
export function stopAfterRemoval(stop: number, removed: number): number {
  return stop >= Math.max(removed, 2) ? stop - 1 : stop;
}

export type RemovalEffect = {
  /** The stop the removed stop's items move to, on the new ladder. */
  movesTo: number;
  /** That stop's gap, for "61 items move down to stop 2 (2 days)". */
  movesToGap: number;
  /** Whether later stops renumber ("stop 4 becomes stop 3"). */
  laterStopsRenumber: boolean;
};

/** What removing a stop would do, for the confirmation before it happens. */
export function removalEffect(ladder: Ladder, removed: number): Result<RemovalEffect, "last-stop"> {
  const result = removeStop(ladder, removed);
  if (!result.ok) return result;
  const movesTo = stopAfterRemoval(removed, removed);
  return ok({
    movesTo,
    movesToGap: gapFor(result.value, movesTo),
    laterStopsRenumber: removed < lastStop(ladder),
  });
}
