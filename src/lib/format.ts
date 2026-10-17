import { daysBetween, type IsoDate } from "@/core";

// Plain dates are formatted in UTC, so a YYYY-MM-DD never shifts by a day in any time zone.
const formatters = {
  long: new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }),
  weekday: new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: "UTC" }),
  dayMonth: new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", timeZone: "UTC" }),
};

const asDate = (date: IsoDate) => new Date(`${date}T00:00:00Z`);

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Thu 1 Oct": confidence buttons, the picked date, All done. Spelled out, since en-GB says "Sept". */
export function shortDate(date: IsoDate): string {
  const d = asDate(date);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** "Mon" and 21: a day in the week strip. */
export function stripDate(date: IsoDate): { weekday: string; day: number } {
  const d = asDate(date);
  return { weekday: WEEKDAYS[d.getUTCDay()] as string, day: d.getUTCDate() };
}

/** "Thursday 24 September": the dashboard heading on desktop. */
export const longDate = (date: IsoDate) => formatters.long.format(asDate(date));

/** "Thursday": the dashboard heading on the phone. */
export const weekday = (date: IsoDate) => formatters.weekday.format(asDate(date));

/** "24 September": under the phone heading. */
export const dayMonth = (date: IsoDate) => formatters.dayMonth.format(asDate(date));

/** "Today", "Tomorrow" or "Yesterday" under the day's heading; null for any other day. */
export function relativeDay(day: IsoDate, today: IsoDate): string | null {
  return { [-1]: "Yesterday", 0: "Today", 1: "Tomorrow" }[daysBetween(today, day)] ?? null;
}

/** "1 item", "38 items". */
export function count(n: number, singular: string, plural = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

/** The overdue marker: "+1 day", "+3 days". */
export const lateLabel = (days: number) => `+${count(days, "day")}`;

/** "example.edu/algo/lecture-07.pdf": a link's address without the scheme. */
export function shortUrl(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}
