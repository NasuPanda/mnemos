/**
 * Calendar dates as plain `YYYY-MM-DD` strings: no time, no time zone, no clock.
 *
 * "Today" is always the user's local date, sent by the browser and passed in as a parameter.
 * The arithmetic below counts whole days on the proleptic Gregorian calendar, so it gives the
 * same answer on any machine in any time zone.
 */
export type IsoDate = string;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

/** True for a real calendar date written as YYYY-MM-DD (so 2026-02-30 is false). */
export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== "string") return false;
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  if (year === undefined || month === undefined || day === undefined || year < 1000) return false;
  return fromDayNumber(Date.UTC(year, month - 1, day) / DAY_MS) === value;
}

/** The date `days` days after `date` (before it, if `days` is negative). */
export function addDays(date: IsoDate, days: number): IsoDate {
  if (!Number.isInteger(days)) throw new RangeError(`addDays needs whole days, got ${days}`);
  return fromDayNumber(toDayNumber(date) + days);
}

/** Whole days from `from` to `to`: positive when `to` is later. */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return toDayNumber(to) - toDayNumber(from);
}

/** Sort order for dates: negative when `a` is earlier, 0 when equal, positive when later. */
export function compareDates(a: IsoDate, b: IsoDate): number {
  return daysBetween(b, a);
}

function toDayNumber(date: IsoDate): number {
  if (!isIsoDate(date)) throw new RangeError(`Not a YYYY-MM-DD date: ${JSON.stringify(date)}`);
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  return Date.UTC(year, month - 1, day) / DAY_MS;
}

function fromDayNumber(dayNumber: number): IsoDate {
  return new Date(dayNumber * DAY_MS).toISOString().slice(0, 10);
}
