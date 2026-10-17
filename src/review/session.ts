import {
  compareDates,
  reviewQueue,
  type IsoDate,
  type ScheduledItem,
  type SectionRef,
} from "@/core";
import type { RunTarget } from "@/lib/routes";

/** What a review run goes through. */
export type Run =
  /** Flash review over everything left today, or a future day's items (Review early). */
  (
    | { kind: "all" }
    /** One section's items (Shift+F, or a line card's review button). */
    | { kind: "section"; sectionId: number }
    /** One item opened from the dashboard; the run returns there after rating. */
    | { kind: "item"; itemId: number }
  ) & {
    /** A future day to review early; left out for today. */
    day?: IsoDate;
  };

/** The run an address asks for. A day that isn't after today means today. */
export function runFromTarget(target: RunTarget, today: IsoDate): Run {
  const day = target.day && compareDates(target.day, today) > 0 ? { day: target.day } : {};
  if (target.itemId) return { kind: "item", itemId: target.itemId, ...day };
  if (target.sectionId) return { kind: "section", sectionId: target.sectionId, ...day };
  return { kind: "all", ...day };
}

/** Tells runs apart, so leaving one for the editor and coming back continues the same one. */
export function runKey(run: Run): string {
  const what =
    run.kind === "all" ? "all" : `${run.kind}-${run.kind === "item" ? run.itemId : run.sectionId}`;
  return run.day ? `${run.day}-${what}` : what;
}

/**
 * The run's items in the dashboard's order: today's Left items, or a future day's items not yet
 * reviewed today. `items` is today's list, or the day's. One item runs only if it is still to
 * review.
 */
export function runQueue(
  run: Run,
  items: readonly ScheduledItem[],
  options: { sections: readonly SectionRef[]; reviewedToday: ReadonlySet<number>; today: IsoDate },
): number[] {
  const queue = reviewQueue(items, {
    ...options,
    day: run.day,
    sectionId: run.kind === "section" ? run.sectionId : undefined,
  }).map((item) => item.id);
  return run.kind === "item" ? queue.filter((id) => id === run.itemId) : queue;
}

/**
 * A review run. The queue is fixed when the run starts, so "3 of 38" stays true while items are
 * rated; Undo returns to the undone item.
 */
export type Session = {
  run: Run;
  queue: readonly number[];
  index: number;
  revealed: boolean;
  pickedDate: IsoDate | null;
};

export function startSession(run: Run, queue: readonly number[]): Session {
  return { run, queue, index: 0, revealed: false, pickedDate: null };
}

/** The item being reviewed, or null when the run is over. */
export function currentItem(session: Session): number | null {
  return session.queue[session.index] ?? null;
}

export function isFinished(session: Session): boolean {
  return session.index >= session.queue.length;
}

/** "1 of 38". */
export function progress(session: Session): { number: number; total: number } {
  const total = session.queue.length;
  return { number: Math.min(session.index + 1, total), total };
}

/** Space, or a tap or click anywhere: show the answer, or hide it again. */
export function toggleAnswer(session: Session): Session {
  return { ...session, revealed: !session.revealed };
}

export function reveal(session: Session): Session {
  return session.revealed ? session : { ...session, revealed: true };
}

/** Pick a date for the next rating, or clear it with null. */
export function pickDate(session: Session, date: IsoDate | null): Session {
  return { ...session, pickedDate: date };
}

/**
 * After a rating: on to the next item still left, problem side first, no picked date.
 * `isLeft` skips items that were rated meanwhile, for example in another tab.
 */
export function advance(session: Session, isLeft: (itemId: number) => boolean): Session {
  let index = session.index + 1;
  while (index < session.queue.length && !isLeft(session.queue[index] as number)) index++;
  return { ...session, index, revealed: false, pickedDate: null };
}

/** Undo: back to the item that was undone, answer showing, ready to rate again. */
export function returnTo(session: Session, itemId: number): Session {
  const index = session.queue.indexOf(itemId);
  if (index === -1) return session;
  return { ...session, index, revealed: true, pickedDate: null };
}

/**
 * Whether rating the current item ends today: it is the last item left today, in a run of
 * today's items (Review early ends on its own day instead). All done comes next, so its picture
 * loads meanwhile. `leftToday` is today's Left items.
 */
export function endsToday(session: Session, leftToday: readonly number[]): boolean {
  const current = currentItem(session);
  return !session.run.day && current !== null && leftToday.length === 1 && leftToday[0] === current;
}
