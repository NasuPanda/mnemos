import { Play, X } from "lucide-react";
import { useEffect, useMemo } from "react";
import { daysLate } from "@/core";
import { SectionBadge } from "@/components/section-badge";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { count, shortDate } from "@/lib/format";
import { navigate, useLocation } from "@/lib/router";
import { dayPath, reviewPath, runTargetFromQuery } from "@/lib/routes";
import { useToday } from "@/lib/today";
import { runFromTarget, runQueue } from "@/review/session";
import { useDayState } from "@/state/day-store";
import { usePanelOpen } from "@/state/overlay";
import { useTodayState } from "@/state/today-store";

/**
 * The flash review start: "Kérjük, vigyázzanak, az ajtók záródnak!" and what the run holds.
 * /flash runs everything left today; /flash?section=ID runs one line; with ?day=YYYY-MM-DD, a
 * future day's items, reviewed early.
 */
export function FlashStartScreen() {
  const today = useToday();
  const state = useTodayState(today);
  const { query } = useLocation();
  const target = useMemo(() => runFromTarget(runTargetFromQuery(query), today), [query, today]);
  const dayState = useDayState(target.day ?? today, today);
  const data = state.status === "ready" ? state.data : null;
  const dayItems = dayState.status === "ready" ? dayState.data.items : null;
  const sectionId = target.kind === "section" ? target.sectionId : undefined;
  const home = dayPath(target.day ?? today, today);

  const run = useMemo(() => {
    if (!data || (target.day && !dayItems)) return null;
    const reviewedToday = new Set(data.reviewsToday.map((r) => r.itemId));
    const source = target.day && dayItems ? dayItems : data.items;
    const ids = runQueue(target, source, { sections: data.sections, reviewedToday, today });
    const byId = new Map(source.map((item) => [item.id, item]));
    const items = ids.flatMap((id) => byId.get(id) ?? []);
    const lines = data.sections
      .map((section) => ({ section, left: items.filter((i) => i.sectionId === section.id).length }))
      .filter((line) => line.left > 0);
    const late = items.filter((item) => daysLate(item.dueOn, today) > 0).length;
    return { items, lines, late };
  }, [data, dayItems, target, today]);

  const empty = run !== null && run.items.length === 0;
  useEffect(() => {
    if (empty) navigate(home, { replace: true });
  }, [empty, home]);

  const start = () => navigate(reviewPath({ day: target.day, sectionId }), { replace: true });
  const panelOpen = usePanelOpen();
  useHotkeys(
    { Enter: start, f: start, Escape: () => navigate(home) },
    !!run && !empty && !panelOpen,
  );

  if (!run || empty) return null;
  const single = sectionId ? run.lines[0]?.section : undefined;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-16 items-center px-3 lg:px-8">
        <Button
          variant="ghost"
          className="h-12 gap-2 px-3 text-item font-bold"
          onClick={() => navigate(home)}
        >
          <X aria-hidden className="size-5" />
          <span className="hidden lg:inline">Close</span>
          <Kbd className="hidden lg:inline-flex">Esc</Kbd>
          <span className="sr-only lg:hidden">Close</span>
        </Button>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center px-4 pt-4 text-center">
        <Doors />
        <h1 lang="hu" className="mt-8 text-heading">
          Kérjük, vigyázzanak, az ajtók záródnak!
        </h1>
        <p className="mt-1 text-body text-muted-foreground">
          Please be careful, the doors are closing!
        </p>

        <section className="mt-8 w-full rounded-xl bg-card p-5 text-left shadow-card">
          <p className="flex items-baseline justify-between gap-3">
            <span className="text-section">
              {count(run.items.length, "item")}
              {single ? ` · ${single.name}` : ` · ${count(run.lines.length, "line")}`}
            </span>
            {run.late > 0 && (
              <span className="text-small text-muted-foreground">{run.late} late</span>
            )}
          </p>
          {target.day && (
            <p className="mt-1 text-small text-muted-foreground">
              Review early, due {shortDate(target.day)}. Reviewing early counts as done today.
            </p>
          )}
          <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-3">
            {run.lines.map(({ section, left }) => (
              <li key={section.id} className="inline-flex items-center gap-2">
                <SectionBadge code={section.code} line={section.line} />
                <span className="font-mono text-meta">{left}</span>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <div className="sticky bottom-0 mx-auto w-full max-w-md px-4 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <Button className="h-14 w-full gap-3 rounded-full text-item font-bold" onClick={start}>
          <Play aria-hidden className="size-5" />
          Start
          <Kbd>Enter</Kbd>
        </Button>
      </div>
    </div>
  );
}

/** Two metro doors meeting in the middle. A placeholder for the phase 5 doors screen. */
function Doors() {
  return (
    <svg viewBox="0 0 216 168" aria-hidden className="h-auto w-[216px]">
      <rect
        x="2"
        y="2"
        width="212"
        height="164"
        rx="12"
        className="fill-none stroke-input"
        strokeWidth="3"
      />
      {[12, 112].map((x) => (
        <g key={x}>
          <rect
            x={x}
            y="12"
            width="92"
            height="144"
            rx="8"
            className="fill-secondary stroke-input"
            strokeWidth="2"
          />
          <rect x={x + 12} y="26" width="68" height="56" rx="5" className="fill-background" />
        </g>
      ))}
      <path
        d="M84 116 l10 10 l-10 10"
        className="fill-none stroke-foreground"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M132 116 l-10 10 l10 10"
        className="fill-none stroke-foreground"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
