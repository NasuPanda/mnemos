import { Play, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { AppShell } from "@/components/app-shell";
import { LineCard } from "@/components/line-card";
import { Link } from "@/components/link";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { dayMonth, longDate, shortDate, weekday } from "@/lib/format";
import { navigate } from "@/lib/router";
import { newItemPath } from "@/lib/routes";
import { useToday } from "@/lib/today";
import { todayView, type TodayData, type TodayView } from "@/state/today-data";
import { load, useTodayState } from "@/state/today-store";
import wideArt from "@/assets/parliament-placeholder-wide.webp";
import narrowArt from "@/assets/parliament-placeholder-narrow.webp";

/** The selected row survives a trip into review mode and back. */
let rememberedSelection: number | null = null;

/** Today's dashboard: the summary, the lines, Start review; All done when nothing is left. */
export function TodayScreen() {
  const date = useToday();
  const state = useTodayState(date);
  const data = state.status === "ready" ? state.data : null;
  const view = useMemo(() => (data ? todayView(data) : null), [data]);

  return (
    <AppShell sections={data?.sections ?? []} lines={view?.lines ?? new Map()}>
      {state.status === "failed" && <LoadFailed date={date} />}
      {data &&
        view &&
        (view.counts.left > 0 ? (
          <Dashboard data={data} view={view} />
        ) : (
          <AllDone data={data} view={view} />
        ))}
    </AppShell>
  );
}

function Dashboard({ data, view }: { data: TodayData; view: TodayView }) {
  const [selectedId, setSelectedId] = useState(rememberedSelection);
  const ids = view.list.map((entry) => entry.item.id);
  const selected = selectedId !== null && ids.includes(selectedId) ? selectedId : null;
  const selectedSection = view.list.find((entry) => entry.item.id === selected)?.item.sectionId;

  const select = (id: number | undefined) => {
    if (id === undefined) return;
    rememberedSelection = id;
    setSelectedId(id);
    document.querySelector(`[data-item-id="${id}"]`)?.scrollIntoView({ block: "nearest" });
  };
  const move = (step: 1 | -1) => {
    if (selected === null) return select(step === 1 ? ids[0] : ids.at(-1));
    const index = Math.min(Math.max(ids.indexOf(selected) + step, 0), ids.length - 1);
    select(ids[index]);
  };

  useHotkeys({
    j: () => move(1),
    k: () => move(-1),
    Enter: () => selected !== null && navigate(`/review?item=${selected}`),
    f: () => navigate("/flash"),
    "Shift+F": () => selectedSection !== undefined && navigate(`/flash?section=${selectedSection}`),
  });

  const groups = data.sections
    .map((section) => ({
      section,
      entries: view.list.filter((entry) => entry.item.sectionId === section.id),
    }))
    .filter((group) => group.entries.length > 0);

  return (
    <main className="mx-auto max-w-[1200px] px-4 pt-8 pb-36 sm:px-6 lg:px-10 lg:pt-10 lg:pb-24">
      <header className="flex items-start justify-between gap-6">
        <Heading date={data.date} />
        <StartReview left={view.counts.left} className="hidden lg:inline-flex" />
      </header>
      <Summary counts={view.counts} />

      <div className="mt-6 grid items-start gap-5 desk:grid-cols-2">
        {groups.map(({ section, entries }) => (
          <LineCard
            key={section.id}
            section={section}
            entries={entries}
            late={entries.filter((entry) => entry.daysLate > 0).length}
            stops={data.ladder.length}
            selectedId={selected}
            reviewHref={`/flash?section=${section.id}`}
          />
        ))}
      </div>

      <StartReview
        left={view.counts.left}
        className="fixed inset-x-4 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-20 h-14 shadow-cta sm:inset-x-auto sm:left-1/2 sm:w-[min(760px,calc(100%-3rem))] sm:-translate-x-1/2 lg:hidden"
      />
      <KeyHintBar />
    </main>
  );
}

function Heading({ date }: { date: string }) {
  return (
    <div>
      <h1 className="text-title">
        <span className="lg:hidden">{weekday(date)}</span>
        <span className="hidden lg:inline">{longDate(date)}</span>
      </h1>
      <p className="mt-1 text-small text-muted-foreground lg:hidden">{dayMonth(date)} · Today</p>
    </div>
  );
}

/** "38 left today · 7 of them late · 9 done" on desktop; "38 left · 7 late · 9 done" on the phone. */
function Summary({ counts }: { counts: TodayView["counts"] }) {
  return (
    <p className="mt-3 text-body text-muted-foreground lg:mt-1">
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

function StartReview({ left, className }: { left: number; className?: string }) {
  return (
    <Button asChild className={cn("h-12 gap-2.5 rounded-full px-6 text-item font-bold", className)}>
      <Link to="/flash">
        <Play aria-hidden className="size-5" />
        Start review · {left}
        <Kbd className="ml-1">F</Kbd>
      </Link>
    </Button>
  );
}

/** The desktop footer of key hints. Touch screens have no keys, so it never shows there. */
function KeyHintBar() {
  const hints: [string[], string][] = [
    [["J", "K"], "move"],
    [["Enter"], "open"],
    [["Shift", "F"], "review line"],
    [["F"], "start review"],
    [["T"], "today"],
  ];
  return (
    <footer className="fixed right-0 bottom-0 left-[248px] z-10 hidden h-11 items-center gap-6 border-t border-border bg-background px-10 text-small text-muted-foreground lg:flex [@media(hover:none)_and_(pointer:coarse)]:hidden">
      {hints.map(([keys, label]) => (
        <span key={label} className="inline-flex items-center gap-2">
          <KbdGroup>
            {keys.map((key) => (
              <Kbd key={key}>{key}</Kbd>
            ))}
          </KbdGroup>
          {label}
        </span>
      ))}
    </footer>
  );
}

/** Végállomás: the rest moment when nothing is left today. */
function AllDone({ data, view }: { data: TodayData; view: TodayView }) {
  if (data.sections.length === 0) return <NoItemsYet date={data.date} />;
  const { tomorrow } = view;
  return (
    <main className="mx-auto max-w-[1200px] px-4 pt-8 pb-12 sm:px-6 lg:px-10 lg:pt-10">
      <Heading date={data.date} />
      <Summary counts={view.counts} />
      <section aria-labelledby="all-done" className="mt-4 flex flex-col items-center text-center">
        <picture className="w-full max-w-[880px]">
          <source media="(max-width: 639px)" srcSet={narrowArt} />
          <img src={wideArt} alt="" className="w-full" />
        </picture>
        <h2 id="all-done" lang="hu" className="mt-2 text-display">
          Végállomás
        </h2>
        <p className="text-body text-muted-foreground">End of the line</p>
        {view.counts.done > 0 && (
          <p className="mt-6 text-body font-bold">{view.counts.done} reviewed today.</p>
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
      </section>
    </main>
  );
}

function NoItemsYet({ date }: { date: string }) {
  return (
    <main className="mx-auto max-w-[1200px] px-4 pt-8 sm:px-6 lg:px-10 lg:pt-10">
      <Heading date={date} />
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

function LoadFailed({ date }: { date: string }) {
  return (
    <main className="mx-auto max-w-[1200px] px-4 pt-8 sm:px-6 lg:px-10 lg:pt-10">
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Today didn’t load</EmptyTitle>
          <EmptyDescription>Check your connection, then try again.</EmptyDescription>
        </EmptyHeader>
        <Button variant="secondary" className="h-12 px-5" onClick={() => void load(date)}>
          Try again
        </Button>
      </Empty>
    </main>
  );
}
