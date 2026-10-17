import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, type IsoDate } from "@/core";
import { Link } from "@/components/link";
import { Button } from "@/components/ui/button";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { longDate, stripDate } from "@/lib/format";
import { dayPath } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type { StripDay } from "@/state/day-data";

/**
 * Seven days, Monday to Sunday. Past days show the reviews done (Fog, a check mark), today the
 * items left (outlined), future days the items due. The day the board shows has a Slate fill and
 * a yellow bar. On desktop, the arrows move a week; [ and ] move a day.
 */
export function WeekStrip({
  days,
  selected,
  today,
  className,
}: {
  days: StripDay[];
  selected: IsoDate;
  today: IsoDate;
  className?: string;
}) {
  return (
    <nav aria-label="Week" className={cn("flex items-center gap-2 lg:gap-3", className)}>
      <WeekArrow to={dayPath(addDays(selected, -7), today)} label="Previous week" />
      <ol className="grid flex-1 grid-cols-7 gap-1 lg:flex lg:gap-1.5">
        {days.map((day) => (
          <li key={day.date} className="lg:min-w-0 lg:flex-1">
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

function DayCell({ day, selected, today }: { day: StripDay; selected: boolean; today: IsoDate }) {
  const { weekday, day: number } = stripDate(day.date);
  const { count } = day;
  const past = count.kind === "past";
  const isToday = count.kind === "today";
  const label = `${longDate(day.date)}${isToday ? ", today" : ""}: ${spoken(day)}`;

  return (
    <Link
      to={dayPath(day.date, today)}
      replace
      aria-label={label}
      aria-current={selected ? "date" : undefined}
      className={cn(
        "relative flex min-h-[4.5rem] flex-col items-center justify-center gap-0.5 rounded-lg border border-transparent pt-1.5 pb-3 lg:min-h-0 lg:items-start lg:gap-1 lg:px-4 lg:pt-2.5 lg:pb-3.5",
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
          "inline-flex items-center gap-0.5 font-mono text-meta whitespace-nowrap lg:gap-1.5",
          past ? "text-subtle-foreground" : "text-foreground",
        )}
      >
        <CountText day={day} />
      </span>
      {selected && (
        <span
          aria-hidden
          className="absolute bottom-1.5 left-1/2 h-1 w-6 -translate-x-1/2 rounded-full bg-primary lg:left-4 lg:translate-x-0"
        />
      )}
    </Link>
  );
}

/** "✓ 31 done" on desktop and "✓31" on the phone; "38 left", "12 due"; "–" for nothing done. */
function CountText({ day }: { day: StripDay }) {
  const { count } = day;
  switch (count.kind) {
    case "past":
      if (count.done === 0) return <>–</>;
      return (
        <>
          <Check aria-hidden className="size-3.5" strokeWidth={2.25} />
          {count.done}
          <span className="hidden lg:inline">done</span>
        </>
      );
    case "today":
      return (
        <>
          {count.left}
          <span className="hidden lg:inline">left</span>
        </>
      );
    case "future":
      return (
        <>
          {count.due}
          <span className="hidden lg:inline">due</span>
        </>
      );
  }
}

function spoken({ count }: StripDay): string {
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
    <Button
      asChild
      variant="secondary"
      size="icon"
      className="hidden size-10 shrink-0 rounded-full lg:inline-flex"
    >
      <Link to={to} replace aria-label={label}>
        <Icon aria-hidden className="size-5" />
      </Link>
    </Button>
  );
}
