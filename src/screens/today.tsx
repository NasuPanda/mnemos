import { Play, Plus } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { addDays, type IsoDate } from "@/core";
import { cn } from "@/lib/utils";
import { AppShell } from "@/components/app-shell";
import { DayCalendar } from "@/components/day/day-calendar";
import { WeekStrip, type StripWeeks } from "@/components/day/week-strip";
import { ItemRow, LineCard, ReviewRow, Station } from "@/components/line-card";
import { Link } from "@/components/link";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Kbd } from "@/components/ui/kbd";
import { KeyHintBar, type KeyHint } from "@/components/key-hint-bar";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { ALL_DONE_ART } from "@/lib/all-done-art";
import { dayMonth, longDate, relativeDay, shortDate, weekday } from "@/lib/format";
import { navigate, useLocation } from "@/lib/router";
import {
  dayFromQuery,
  dayPath,
  editItemPath,
  flashPath,
  newItemPath,
  reviewPath,
} from "@/lib/routes";
import { openItemSearch } from "@/lib/item-search-focus";
import { useToday } from "@/lib/today";
import {
  dayKind,
  futureDayView,
  pastDayView,
  blankStrip,
  stripDays,
  type DayData,
} from "@/state/day-data";
import { retryDay, useAnyDayAnswered, useDayState, useWeek } from "@/state/day-store";
import { openHistory } from "@/state/history-panel";
import { usePanelOpen } from "@/state/overlay";
import { todayView, type TodayData, type TodayView } from "@/state/today-data";
import { load, useTodayState } from "@/state/today-store";
import type { SectionDto } from "../../worker/contract";

/** The selected row survives a trip into review mode and back. */
let rememberedSelection: number | null = null;

/**
 * The dashboard for one day: today (or All done when nothing is left), a future day with Review
 * early, or a past day's reviews. /?day=YYYY-MM-DD picks the day; [ and ] move one.
 */
export function TodayScreen() {
  const today = useToday();
  const { query } = useLocation();
  const day = dayFromQuery(query, today);
  const kind = dayKind(day, today);
  const state = useTodayState(today);
  const dayState = useDayState(day, today);
  const week = useWeek(day, today);
  const previousWeek = useWeek(addDays(day, -7), today);
  const nextWeek = useWeek(addDays(day, 7), today);
  const data = state.status === "ready" ? state.data : null;
  const view = useMemo(() => (data ? todayView(data) : null), [data]);
  const strip = useMemo((): StripWeeks | null => {
    if (!view) return null;
    const left = view.counts.left;
    // A week not fetched yet shows its dates; its counts fill in when they arrive.
    const of = (rows: typeof week, date: IsoDate) =>
      rows ? stripDays(rows, today, left) : blankStrip(date, today, left);
    return {
      days: of(week, day),
      previous: of(previousWeek, addDays(day, -7)),
      next: of(nextWeek, addDays(day, 7)),
    };
  }, [view, week, previousWeek, nextWeek, day, today]);

  const panelOpen = usePanelOpen();
  useHotkeys(
    {
      "[": () => navigate(dayPath(addDays(day, -1), today), { replace: true }),
      "]": () => navigate(dayPath(addDays(day, 1), today), { replace: true }),
    },
    !panelOpen,
  );

  // The first screen waits for the week strip's counts too, so nothing moves when they arrive;
  // after that, another week shows its dates at once.
  const stripSettled = useAnyDayAnswered(today);
  const dayData = dayState.status === "ready" ? dayState.data : null;
  const failed =
    state.status === "failed" || (kind !== "today" && dayState.status === "failed" && !week);

  let content: ReactNode = null;
  if (failed) {
    content = (
      <LoadFailed
        onRetry={() => {
          if (state.status === "failed") void load(today);
          void retryDay(day, today);
        }}
      />
    );
  } else if (data && view && stripSettled) {
    const frame = { day, today, strip };
    if (kind === "today") {
      content =
        view.counts.left > 0 ? (
          <TodayBoard {...frame} data={data} view={view} />
        ) : (
          <AllDone {...frame} data={data} view={view} />
        );
    } else if (kind === "future") {
      content = <FutureBoard {...frame} data={data} dayData={dayData} />;
    } else {
      content = <PastBoard {...frame} data={data} dayData={dayData} />;
    }
  }

  return (
    <AppShell sections={data?.sections ?? []} lines={view?.lines ?? new Map()}>
      {content}
    </AppShell>
  );
}

type Frame = { day: IsoDate; today: IsoDate; strip: StripWeeks | null };

/**
 * The frame every day shares. Desktop: the date, the summary, then the week strip, with the
 * day's main action at the top right. Phone: the weekday and date, the Today and calendar
 * buttons, the strip, then the summary; the main action floats above the tab bar.
 */
function Board({
  day,
  today,
  strip,
  summary,
  action,
  hints,
  children,
}: Frame & {
  summary: ReactNode;
  action?: { href: string; label: string };
  hints: KeyHint[];
  children: ReactNode;
}) {
  return (
    <main className="mx-auto max-w-[1200px] px-4 pt-8 pb-36 sm:px-6 lg:px-10 lg:pt-10 lg:pb-24">
      {/* One grid, two orders: the summary sits under the date on desktop, under the strip on
          the phone. */}
      <header className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 lg:gap-x-6">
        <Heading day={day} today={today} />
        <div className="col-start-2 row-start-1 flex items-center gap-3 lg:row-span-2 lg:self-center">
          {action && <MainAction {...action} className="hidden lg:inline-flex" />}
          <span className="flex items-center gap-3 lg:hidden">
            {day !== today && (
              <Button
                asChild
                variant="secondary"
                className="h-12 rounded-full px-5 text-item font-bold"
              >
                <Link to={dayPath(today, today)} replace>
                  Today
                </Link>
              </Button>
            )}
            <DayCalendar day={day} today={today} />
          </span>
        </div>
        <div className="col-span-2 row-start-3 mt-4 lg:col-span-1 lg:row-start-2 lg:mt-1">
          {summary}
        </div>
        {strip && (
          <WeekStrip
            weeks={strip}
            selected={day}
            today={today}
            className="col-span-2 row-start-2 mt-4 -mx-1 lg:row-start-3 lg:mx-0 lg:mt-6"
          />
        )}
      </header>
      {children}
      {action && (
        <MainAction
          {...action}
          className="fixed inset-x-4 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-20 h-14 shadow-cta sm:inset-x-auto sm:left-1/2 sm:w-[min(760px,calc(100%-3rem))] sm:-translate-x-1/2 lg:hidden"
        />
      )}
      <KeyHintBar hints={hints} />
    </main>
  );
}

function Heading({ day, today }: { day: IsoDate; today: IsoDate }) {
  const relative = relativeDay(day, today);
  return (
    <div className="min-w-0">
      <h1 className="text-title">
        <span className="lg:hidden">{weekday(day)}</span>
        <span className="hidden lg:inline">{longDate(day)}</span>
      </h1>
      <p className="mt-1 text-small text-muted-foreground lg:hidden">
        {dayMonth(day)}
        {relative && ` · ${relative}`}
      </p>
    </div>
  );
}

/** Start review or Review early: the day's one yellow button. */
function MainAction({
  href,
  label,
  className,
}: {
  href: string;
  label: string;
  className?: string;
}) {
  return (
    <Button asChild className={cn("h-12 gap-2.5 rounded-full px-6 text-item font-bold", className)}>
      <Link to={href}>
        <Play aria-hidden className="size-5" />
        {label}
        <Kbd className="ml-1">F</Kbd>
      </Link>
    </Button>
  );
}

/** J/K over the rows that can be opened; the selection survives a trip into review mode. */
function useSelection(ids: number[]) {
  const [selectedId, setSelectedId] = useState(rememberedSelection);
  const selected = selectedId !== null && ids.includes(selectedId) ? selectedId : null;
  const select = (id: number | undefined) => {
    if (id === undefined) return;
    rememberedSelection = id;
    setSelectedId(id);
    document.querySelector(`[data-row-id="${id}"]`)?.scrollIntoView({ block: "nearest" });
  };
  const move = (step: 1 | -1) => {
    if (selected === null) return select(step === 1 ? ids[0] : ids.at(-1));
    const index = Math.min(Math.max(ids.indexOf(selected) + step, 0), ids.length - 1);
    select(ids[index]);
  };
  return { selected, move };
}

/** Rows grouped by line, in the person's section order; lines with nothing are left out. */
function byLine<T>(sections: SectionDto[], rows: T[], sectionOf: (row: T) => number) {
  return sections
    .map((section) => ({ section, rows: rows.filter((row) => sectionOf(row) === section.id) }))
    .filter((group) => group.rows.length > 0);
}

function TodayBoard({ data, view, ...frame }: Frame & { data: TodayData; view: TodayView }) {
  const { selected, move } = useSelection(view.list.map((entry) => entry.item.id));
  const selectedSection = view.list.find((entry) => entry.item.id === selected)?.item.sectionId;

  useHotkeys(
    {
      j: () => move(1),
      k: () => move(-1),
      Enter: () => selected !== null && navigate(reviewPath({ itemId: selected })),
      f: () => navigate(flashPath()),
      "Shift+F": () =>
        selectedSection !== undefined && navigate(flashPath({ sectionId: selectedSection })),
      "/": openItemSearch,
      e: () => selected !== null && navigate(editItemPath(selected)),
      h: () => selected !== null && openHistory(selected),
    },
    !usePanelOpen(),
  );

  return (
    <Board
      {...frame}
      summary={<TodaySummary counts={view.counts} />}
      action={{ href: flashPath(), label: `Start review · ${view.counts.left}` }}
      hints={[
        [["J", "K"], "move"],
        [["Enter"], "open"],
        // The selected line's card shows Shift F, and the sidebar shows N.
        [["Shift", "F"], "review line", { wide: true }],
        [["E"], "edit"],
        [["H"], "history"],
        [["[", "]"], "day"],
        [["N"], "new item", { wide: true }],
        [["?"], "all keys"],
      ]}
    >
      <div className="mt-6 grid items-start gap-5 desk:grid-cols-2">
        {byLine(data.sections, view.list, (entry) => entry.item.sectionId).map(
          ({ section, rows }) => {
            const late = rows.filter((entry) => entry.daysLate > 0).length;
            return (
              <LineCard
                key={section.id}
                section={section}
                summary={`${rows.length} left${late > 0 ? ` · ${late} late` : ""}`}
                reviewHref={flashPath({ sectionId: section.id })}
                shiftHint={selectedSection === section.id}
              >
                {rows.map((entry, index) => (
                  <Station
                    key={entry.item.id}
                    section={section}
                    rowId={entry.item.id}
                    first={index === 0}
                    last={index === rows.length - 1}
                    selected={entry.item.id === selected}
                    to={reviewPath({ itemId: entry.item.id })}
                  >
                    <ItemRow entry={entry} stops={data.ladder.length} />
                  </Station>
                ))}
              </LineCard>
            );
          },
        )}
      </div>
    </Board>
  );
}

/** "38 left today · 7 of them late · 9 done" on desktop; "38 left · 7 late · 9 done" on the phone. */
function TodaySummary({ counts }: { counts: TodayView["counts"] }) {
  return (
    <p className="text-body text-muted-foreground">
      <strong className="font-bold text-foreground">
        {counts.left} left<span className="hidden lg:inline"> today</span>
      </strong>
      {counts.late > 0 && (
        <>
          {" · "}
          {counts.late} <span className="hidden lg:inline">of them </span>late
        </>
      )}
      {" · "}
      {counts.done} done
    </p>
  );
}

/**
 * A future day: its items due, the ones already reviewed today dimmed and last in their line,
 * and Review early for the rest. Early reviews count as done today.
 */
function FutureBoard({
  data,
  dayData,
  ...frame
}: Frame & { data: TodayData; dayData: DayData | null }) {
  const reviewed = useMemo(() => new Set(data.reviewsToday.map((r) => r.itemId)), [data]);
  const view = useMemo(
    () => (dayData ? futureDayView(dayData, data.sections, reviewed) : null),
    [dayData, data.sections, reviewed],
  );
  const open = view?.list.filter((entry) => !entry.reviewedToday) ?? [];
  const { selected, move } = useSelection(open.map((entry) => entry.item.id));
  const selectedSection = open.find((entry) => entry.item.id === selected)?.item.sectionId;
  const { day } = frame;
  const early = view?.counts.early ?? 0;

  useHotkeys(
    {
      j: () => move(1),
      k: () => move(-1),
      Enter: () => selected !== null && navigate(reviewPath({ day, itemId: selected })),
      f: () => early > 0 && navigate(flashPath({ day })),
      "Shift+F": () =>
        selectedSection !== undefined && navigate(flashPath({ day, sectionId: selectedSection })),
      "/": openItemSearch,
      e: () => selected !== null && navigate(editItemPath(selected)),
      h: () => selected !== null && openHistory(selected),
    },
    !usePanelOpen(),
  );

  return (
    <Board
      {...frame}
      summary={view && <FutureSummary counts={view.counts} />}
      action={
        early > 0 ? { href: flashPath({ day }), label: `Review early · ${early}` } : undefined
      }
      hints={[
        [["J", "K"], "move"],
        [["Enter"], "review early"],
        [["Shift", "F"], "review line", { wide: true }],
        [["E"], "edit"],
        [["H"], "history"],
        [["[", "]"], "day"],
        [["N"], "new item", { wide: true }],
        [["?"], "all keys"],
      ]}
    >
      {view && view.list.length === 0 && (
        <Empty className="mt-10">
          <EmptyHeader>
            <EmptyTitle>Nothing due</EmptyTitle>
            <EmptyDescription>No items come back on {longDate(day)}.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
      {view && (
        <div className="mt-6 grid items-start gap-5 desk:grid-cols-2">
          {byLine(data.sections, view.list, (entry) => entry.item.sectionId).map(
            ({ section, rows }) => {
              const line = view.lines.get(section.id);
              return (
                <LineCard
                  key={section.id}
                  section={section}
                  summary={`${line?.due ?? rows.length} due${line?.reviewedToday ? ` · ${line.reviewedToday} reviewed today` : ""}`}
                  reviewHref={line?.early ? flashPath({ day, sectionId: section.id }) : undefined}
                  shiftHint={selectedSection === section.id}
                >
                  {rows.map((entry, index) => (
                    <Station
                      key={entry.item.id}
                      section={section}
                      rowId={entry.item.id}
                      first={index === 0}
                      last={index === rows.length - 1}
                      selected={entry.item.id === selected}
                      dimmed={entry.reviewedToday}
                      to={
                        entry.reviewedToday ? undefined : reviewPath({ day, itemId: entry.item.id })
                      }
                    >
                      <ItemRow entry={entry} stops={data.ladder.length} />
                    </Station>
                  ))}
                </LineCard>
              );
            },
          )}
        </div>
      )}
    </Board>
  );
}

/** "17 due · 5 reviewed today", and what reviewing early means. */
function FutureSummary({ counts }: { counts: { due: number; reviewedToday: number } }) {
  return (
    <>
      <p className="text-body text-muted-foreground">
        <strong className="font-bold text-foreground">{counts.due} due</strong>
        {counts.reviewedToday > 0 && ` · ${counts.reviewedToday} reviewed today`}
      </p>
      {counts.due > counts.reviewedToday && (
        <p className="text-small text-muted-foreground">Reviewing early counts as done today.</p>
      )}
    </>
  );
}

/** A past day: only the reviews done that day. Missed items never show here. */
function PastBoard({
  data,
  dayData,
  ...frame
}: Frame & { data: TodayData; dayData: DayData | null }) {
  const reviews = useMemo(
    () => (dayData ? pastDayView(dayData, data.sections) : null),
    [dayData, data.sections],
  );
  const { day } = frame;
  const { selected, move } = useSelection(reviews?.map((review) => review.id) ?? []);
  const selectedItem = reviews?.find((review) => review.id === selected)?.itemId;
  const history = () => selectedItem !== undefined && openHistory(selectedItem);
  useHotkeys({ j: () => move(1), k: () => move(-1), Enter: history, h: history }, !usePanelOpen());

  return (
    <Board
      {...frame}
      summary={
        reviews && (
          <p className="text-body text-muted-foreground">
            <strong className="font-bold text-foreground">{reviews.length} reviewed</strong>
          </p>
        )
      }
      hints={[
        [["J", "K"], "move"],
        [["H"], "history"],
        [["[", "]"], "day"],
        [["N"], "new item"],
        [["?"], "all keys"],
      ]}
    >
      {reviews && reviews.length === 0 && (
        <Empty className="mt-10">
          <EmptyHeader>
            <EmptyTitle>No reviews</EmptyTitle>
            <EmptyDescription>Nothing was reviewed on {longDate(day)}.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
      {reviews && (
        <div className="mt-6 grid items-start gap-5 desk:grid-cols-2">
          {byLine(data.sections, reviews, (review) => review.sectionId).map(({ section, rows }) => (
            <LineCard key={section.id} section={section} summary={`${rows.length} reviewed`}>
              {rows.map((review, index) => (
                <Station
                  key={review.id}
                  section={section}
                  rowId={review.id}
                  first={index === 0}
                  last={index === rows.length - 1}
                  selected={review.id === selected}
                  onOpen={() => openHistory(review.itemId)}
                >
                  <ReviewRow review={review} stops={data.ladder.length} />
                </Station>
              ))}
            </LineCard>
          ))}
        </div>
      )}
    </Board>
  );
}

/**
 * Végállomás: the rest moment when nothing is left today. Review early is a neutral button here:
 * nothing yellow sits next to the picture.
 */
function AllDone({ data, view, day, today, strip }: Frame & { data: TodayData; view: TodayView }) {
  const { tomorrow } = view;
  const early = tomorrow.due - tomorrow.reviewedToday;
  const reviewEarly = flashPath({ day: tomorrow.date });
  useHotkeys({ f: () => early > 0 && navigate(reviewEarly) }, !usePanelOpen());

  if (data.sections.length === 0) return <NoItemsYet day={day} today={today} />;
  const weekStrip = (className: string) =>
    strip && <WeekStrip weeks={strip} selected={day} today={today} className={className} />;

  return (
    <main className="mx-auto max-w-[1200px] px-4 pb-36 sm:px-6 lg:px-10 lg:pt-10 lg:pb-24">
      <div className="hidden lg:block">
        <Heading day={day} today={today} />
        <div className="mt-1">
          <TodaySummary counts={view.counts} />
        </div>
        {weekStrip("mt-6")}
      </div>
      <section aria-labelledby="all-done" className="flex flex-col items-center text-center">
        {/* Phone: full width at the top, the bottom fading into the page. From 640 px: centred,
            every edge fading. The words start below the lit part. */}
        <div className="relative -mx-4 w-[calc(100%+2rem)] sm:mx-0 sm:w-full sm:max-w-[760px] lg:max-w-[840px]">
          <img
            src={ALL_DONE_ART.src}
            srcSet={ALL_DONE_ART.srcSet}
            sizes={ALL_DONE_ART.sizes}
            width={ALL_DONE_ART.width}
            height={ALL_DONE_ART.height}
            alt=""
            decoding="async"
            className="block h-auto w-full [mask-image:linear-gradient(to_bottom,black_70%,transparent)] sm:[mask-image:radial-gradient(closest-side,black_65%,transparent)]"
          />
          <span className="absolute top-8 right-4 lg:hidden">
            <DayCalendar day={day} today={today} />
          </span>
        </div>
        <p className="-mt-6 text-label text-muted-foreground sm:mt-0 lg:hidden">
          {longDate(day)} · today
        </p>
        {weekStrip("mt-3 w-full -mx-1 lg:hidden")}
        <h2 id="all-done" lang="hu" className="mt-6 text-display lg:-mt-10">
          Végállomás
        </h2>
        <p className="text-body text-muted-foreground">End of the line</p>
        <p className="mt-4 text-body text-muted-foreground lg:hidden">
          <strong className="font-bold text-foreground">0 left</strong> · {view.counts.done} done
        </p>
        {view.counts.done > 0 && (
          <p className="mt-6 hidden text-body font-bold lg:block">
            {view.counts.done} reviewed today.
          </p>
        )}
        <p className="mt-2 max-w-md text-body text-muted-foreground">
          {tomorrow.due === 0 ? (
            <>Nothing is due tomorrow, {shortDate(tomorrow.date)}.</>
          ) : (
            <>
              Tomorrow, {shortDate(tomorrow.date)}:{" "}
              <strong className="font-bold text-foreground">{tomorrow.due} due</strong>
              {tomorrow.reviewedToday > 0 &&
                `, ${tomorrow.reviewedToday} of them already reviewed today`}
              .
            </>
          )}
        </p>
        {early > 0 && (
          <ReviewEarly href={reviewEarly} early={early} className="mt-6 hidden lg:inline-flex" />
        )}
      </section>
      {early > 0 && (
        <ReviewEarly
          href={reviewEarly}
          early={early}
          className="fixed inset-x-4 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-20 h-14 shadow-cta sm:inset-x-auto sm:left-1/2 sm:w-[min(760px,calc(100%-3rem))] sm:-translate-x-1/2 lg:hidden"
        />
      )}
      <KeyHintBar
        hints={[
          ...(early > 0 ? [[["F"], "review early"] satisfies KeyHint] : []),
          [["[", "]"], "day"],
          [["N"], "new item"],
          [["?"], "all keys"],
        ]}
      />
    </main>
  );
}

/** All done's Review early: neutral, for tomorrow's items not yet reviewed today. */
function ReviewEarly({
  href,
  early,
  className,
}: {
  href: string;
  early: number;
  className?: string;
}) {
  return (
    <Button
      asChild
      variant="secondary"
      className={cn("h-12 gap-2.5 rounded-full px-6 text-item font-bold", className)}
    >
      <Link to={href}>
        <Play aria-hidden className="size-5" />
        Review early · {early}
        <Kbd className="ml-1">F</Kbd>
      </Link>
    </Button>
  );
}

function NoItemsYet({ day, today }: { day: IsoDate; today: IsoDate }) {
  return (
    <main className="mx-auto max-w-[1200px] px-4 pt-8 sm:px-6 lg:px-10 lg:pt-10">
      <Heading day={day} today={today} />
      <Empty className="mt-10">
        <EmptyHeader>
          <EmptyTitle>No items yet</EmptyTitle>
          <EmptyDescription>
            Add your first one: a problem, its answer, and a photo if it helps. It’s due today.
          </EmptyDescription>
        </EmptyHeader>
        <Button asChild variant="secondary" className="h-12 gap-2 px-5 text-item font-bold">
          <Link to={newItemPath()}>
            <Plus aria-hidden className="size-5" />
            New item
            <Kbd className="ml-1">N</Kbd>
          </Link>
        </Button>
      </Empty>
    </main>
  );
}

function LoadFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="mx-auto max-w-[1200px] px-4 pt-8 sm:px-6 lg:px-10 lg:pt-10">
      <Empty>
        <EmptyHeader>
          <EmptyTitle>This day didn’t load</EmptyTitle>
          <EmptyDescription>Check your connection, then try again.</EmptyDescription>
        </EmptyHeader>
        <Button variant="secondary" className="h-12 px-5" onClick={onRetry}>
          Try again
        </Button>
      </Empty>
    </main>
  );
}
