import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useLayoutEffect, useRef } from "react";
import { addDays, type IsoDate } from "@/core";
import { Link } from "@/components/link";
import { Button } from "@/components/ui/button";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { DESKTOP, useMediaQuery } from "@/hooks/use-media-query";
import { longDate, stripDate } from "@/lib/format";
import { navigate } from "@/lib/router";
import { dayPath } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { swipedDay, type StripDay } from "@/state/day-data";

/** The week on show and the weeks either side of it, for the arrows and the swipe. */
export type StripWeeks = { days: StripDay[]; previous: StripDay[]; next: StripDay[] };

/**
 * Seven days, Monday to Sunday. Past days show the reviews done (Fog, a check mark), today the
 * items left (outlined), future days the items due. The day the board shows has a Slate fill and
 * a yellow bar. On desktop, the arrows move a week and [ and ] a day; below 1024 px the strip
 * swipes sideways to the previous or next week (issue #13).
 */
export function WeekStrip({
  weeks,
  selected,
  today,
  className,
}: {
  weeks: StripWeeks;
  selected: IsoDate;
  today: IsoDate;
  className?: string;
}) {
  const desktop = useMediaQuery(DESKTOP);
  if (!desktop) {
    return <SwipeStrip weeks={weeks} selected={selected} today={today} className={className} />;
  }
  return (
    <nav aria-label="Week" className={cn("flex items-center gap-3", className)}>
      <WeekArrow to={dayPath(addDays(selected, -7), today)} label="Previous week" />
      <ol className="flex min-w-0 flex-1 gap-1.5">
        {weeks.days.map((day) => (
          <li key={day.date} className="min-w-0 flex-1">
            <DayCell day={day} selected={day.date === selected} today={today} />
          </li>
        ))}
      </ol>
      <WeekArrow to={dayPath(addDays(selected, 7), today)} label="Next week" next />
      <span className="hidden shrink-0 items-center gap-2 text-small text-muted-foreground xl:inline-flex">
        <KbdGroup>
          <Kbd>[</Kbd>
          <Kbd>]</Kbd>
        </KbdGroup>
        day
      </span>
    </nav>
  );
}

/** How long the strip has to be still before a swipe counts as settled. */
const SETTLE_MS = 120;

/**
 * The phone's strip: three weeks side by side that snap to whole weeks, starting on the middle
 * one. Settling on the previous or next week moves the day a week, and the strip re-centres on
 * it before the next paint, so the week just swiped to stays where it is.
 */
function SwipeStrip({
  weeks,
  selected,
  today,
  className,
}: {
  weeks: StripWeeks;
  selected: IsoDate;
  today: IsoDate;
  className?: string;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const settle = useRef<number | undefined>(undefined);
  const week = weeks.days[0]?.date;

  const centre = () => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.clientWidth;
  };
  useLayoutEffect(centre, [week]);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    // A phone turned sideways changes the width of a week.
    const observer = new ResizeObserver(centre);
    observer.observe(el);
    return () => {
      observer.disconnect();
      window.clearTimeout(settle.current);
    };
  }, []);

  const onScroll = () => {
    window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => {
      const el = scroller.current;
      if (!el || el.clientWidth === 0) return;
      const day = swipedDay(selected, Math.round(el.scrollLeft / el.clientWidth));
      if (day) navigate(dayPath(day, today), { replace: true });
    }, SETTLE_MS);
  };

  return (
    <nav aria-label="Week" className={className}>
      <div
        ref={scroller}
        data-week-strip
        onScroll={onScroll}
        className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {[weeks.previous, weeks.days, weeks.next].map((days, page) => (
          // The side weeks are there to swipe to; until then they are out of reach of the
          // keyboard and screen readers, which use the calendar button instead.
          <ol
            key={days[0]?.date ?? page}
            aria-hidden={page === 1 ? undefined : true}
            inert={page !== 1}
            className="grid w-full shrink-0 snap-center grid-cols-7 gap-1 px-1"
          >
            {days.map((day) => (
              <li key={day.date}>
                <DayCell day={day} selected={day.date === selected} today={today} />
              </li>
            ))}
          </ol>
        ))}
      </div>
    </nav>
  );
}

function DayCell({ day, selected, today }: { day: StripDay; selected: boolean; today: IsoDate }) {
  const { weekday, day: number } = stripDate(day.date);
  const { count } = day;
  const past = count?.kind === "past";
  const isToday = count?.kind === "today";
  const said = spoken(day);
  const label = `${longDate(day.date)}${isToday ? ", today" : ""}${said ? `: ${said}` : ""}`;

  return (
    <Link
      to={dayPath(day.date, today)}
      replace
      aria-label={label}
      aria-current={selected ? "date" : undefined}
      className={cn(
        "relative flex min-h-[4.5rem] flex-col items-center justify-center gap-0.5 rounded-lg border border-transparent pt-1.5 pb-3 lg:min-h-0 lg:items-start lg:gap-1 lg:px-2.5 lg:pt-2.5 lg:pb-3.5 xl:px-4",
        selected ? "bg-muted" : "hover:bg-accent/60",
        isToday && !selected && "border-subtle-foreground",
      )}
    >
      {/* Phone: the weekday over a large date. Desktop: "Mon 21" on one line. */}
      <span
        aria-hidden
        className={cn(
          "text-label font-normal lg:hidden",
          past ? "text-subtle-foreground" : "text-muted-foreground",
          (isToday || selected) && "text-foreground",
        )}
      >
        {weekday}
      </span>
      <span
        aria-hidden
        className={cn(
          "text-heading lg:hidden",
          past ? "text-subtle-foreground" : "text-foreground",
        )}
      >
        {number}
      </span>
      <span
        aria-hidden
        className={cn(
          "hidden truncate text-label font-bold lg:block",
          past ? "text-subtle-foreground" : "text-foreground",
        )}
      >
        {weekday} {number}
      </span>
      <span
        aria-hidden
        className={cn(
          "inline-flex items-center gap-0.5 font-mono text-meta whitespace-nowrap xl:gap-1.5",
          past ? "text-subtle-foreground" : "text-foreground",
        )}
      >
        <CountText day={day} />
      </span>
      {selected && (
        <span
          aria-hidden
          className="absolute bottom-1.5 left-1/2 h-1 w-6 -translate-x-1/2 rounded-full bg-primary lg:left-2.5 lg:translate-x-0 xl:left-4"
        />
      )}
    </Link>
  );
}

/**
 * "✓ 31 done", "38 left", "12 due" from 1280 px; below that the number alone, as on the phone.
 * "–" for a past day with nothing done.
 */
function CountText({ day }: { day: StripDay }) {
  const { count } = day;
  // Not loaded yet: keep the line's height so nothing moves when the count arrives.
  if (!count) return <>&nbsp;</>;
  switch (count.kind) {
    case "past":
      if (count.done === 0) return <>–</>;
      return (
        <>
          <Check aria-hidden className="size-3.5" strokeWidth={2.25} />
          {count.done}
          <span className="hidden xl:inline">done</span>
        </>
      );
    case "today":
      return (
        <>
          {count.left}
          <span className="hidden xl:inline">left</span>
        </>
      );
    case "future":
      return (
        <>
          {count.due}
          <span className="hidden xl:inline">due</span>
        </>
      );
  }
}

function spoken({ count }: StripDay): string {
  if (!count) return "";
  switch (count.kind) {
    case "past":
      return count.done === 0 ? "nothing reviewed" : `${count.done} reviewed`;
    case "today":
      return `${count.left} left`;
    case "future":
      return `${count.due} due`;
  }
}

function WeekArrow({ to, label, next = false }: { to: string; label: string; next?: boolean }) {
  const Icon = next ? ChevronRight : ChevronLeft;
  return (
    <Button asChild variant="secondary" size="icon" className="size-10 shrink-0 rounded-full">
      <Link to={to} replace aria-label={label}>
        <Icon aria-hidden className="size-5" />
      </Link>
    </Button>
  );
}
