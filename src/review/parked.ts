import type { ItemDto } from "../../worker/contract";
import type { Session } from "./session";

/** A review run set aside while its current item is open in the editor. */
type Parked = { key: string; items: Map<number, ItemDto>; session: Session };

let parked: Parked | null = null;

/** Sets the run aside: coming back to the same run continues where it was. */
export function parkRun(run: Parked): void {
  parked = run;
}

/** The parked run, if it is this one. Reading leaves it parked until `clearParkedRun`. */
export function parkedRun(key: string): Parked | null {
  return parked?.key === key ? parked : null;
}

export function clearParkedRun(): void {
  parked = null;
}
