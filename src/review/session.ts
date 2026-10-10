import type { IsoDate } from "@/core";

/** What a review run goes through. */
export type Run =
  /** Flash review over everything left today. */
  | { kind: "all" }
  /** One section's items left today (Shift+F, or a line card's review button). */
  | { kind: "section"; sectionId: number }
  /** One item opened from the dashboard; the run returns there after rating. */
  | { kind: "item"; itemId: number };

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
