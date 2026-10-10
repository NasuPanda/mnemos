import { Eye, Lightbulb, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { toast } from "sonner";
import { daysLate, ratingOptions, reviewQueue, type Confidence, type IsoDate } from "@/core";
import { Overdue } from "@/components/overdue";
import { ExternalLink } from "@/components/review/external-link";
import { ImageZoom } from "@/components/review/image-zoom";
import { ImageGrid, Thumbnails } from "@/components/review/images";
import { RatingDock } from "@/components/review/rating-dock";
import { InlineMarkdown, Markdown } from "@/components/markdown";
import { SectionBadge } from "@/components/section-badge";
import { StopIndicator } from "@/components/stop-indicator";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { useMediaQuery } from "@/hooks/use-media-query";
import { navigate, useLocation } from "@/lib/router";
import { useToday } from "@/lib/today";
import { cn } from "@/lib/utils";
import {
  advance,
  currentItem,
  isFinished,
  pickDate,
  progress,
  returnTo,
  reveal,
  startSession,
  toggleAnswer,
  type Run,
  type Session,
} from "@/review/session";
import { offerUndo, onUndone, undoLast } from "@/review/undo";
import type { TodayData } from "@/state/today-data";
import { rateItem, useTodayState } from "@/state/today-store";
import type { ImageDto, ItemDto } from "../../worker/contract";

/** Review mode: /review?item=ID (one item), ?section=ID (one line) or no query (everything). */
export function ReviewScreen() {
  const date = useToday();
  const state = useTodayState(date);
  const { query } = useLocation();
  const run = useMemo(() => parseRun(query), [query]);
  if (state.status !== "ready") return null;
  return <ReviewRun key={runKey(run)} data={state.data} run={run} />;
}

function ReviewRun({ data, run }: { data: TodayData; run: Run }) {
  // The run's items, kept for the whole run: a rated item leaves today's list but stays on screen
  // until the next one, and comes back as it was on Undo.
  const [items] = useState(() => new Map(data.items.map((item) => [item.id, item])));
  const [session, setSession] = useState<Session>(() => startSession(run, queueFor(data, run)));
  const [pressed, setPressed] = useState<Confidence | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [zoom, setZoom] = useState<{ images: ImageDto[]; index: number } | null>(null);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

  const left = useRef(new Set<number>());
  useEffect(() => {
    left.current = new Set(data.items.map((item) => item.id));
  }, [data.items]);

  useEffect(() => onUndone((itemId) => setSession((s) => returnTo(s, itemId))), []);

  const finished = isFinished(session);
  useEffect(() => {
    // Back to the dashboard: All done if nothing is left, or the rest of today's lines.
    if (finished) navigate("/", { replace: true });
  }, [finished]);

  const itemId = currentItem(session);
  const item = itemId === null ? undefined : items.get(itemId);
  const section = data.sections.find((s) => s.id === item?.sectionId);

  const rate = (confidence: Confidence) => {
    if (!item || !session.revealed || pressed) return;
    const result = rateItem(item.id, confidence, session.pickedDate ?? undefined);
    if (!result.ok) return void toast(REFUSALS[result.error]);
    offerUndo(result.value);
    setPressed(confidence);
    window.setTimeout(
      () => {
        setPressed(null);
        setSession((s) => advance(s, (id) => left.current.has(id)));
        window.scrollTo({ top: 0 });
      },
      reducedMotion ? 0 : 120,
    );
  };

  const visibleImages = item
    ? item.images.filter((image) => session.revealed || image.side === "problem")
    : [];
  const openZoom = (image: ImageDto) =>
    setZoom({ images: visibleImages, index: Math.max(visibleImages.indexOf(image), 0) });

  useHotkeys(
    {
      Space: () => setSession(toggleAnswer),
      "1": () => rate("confident"),
      "2": () => rate("neutral"),
      "3": () => rate("not_at_all"),
      d: () => session.revealed && setPickerOpen(true),
      z: () => visibleImages[0] && openZoom(visibleImages[0]),
      u: () => void undoLast(),
      Escape: () => navigate("/"),
    },
    zoom === null && !pickerOpen,
  );

  if (!item || !section) return null;

  const revealOnTap = (event: MouseEvent) => {
    if (session.revealed) return;
    const target = event.target as HTMLElement;
    if (target.closest("a, button, input, [data-no-reveal]")) return;
    if (window.getSelection()?.toString()) return;
    setSession(reveal);
  };

  const { number, total } = progress(session);
  const options = ratingOptions(item.stop, data.ladder, data.date);
  const hasLinksOrImages = item.images.some((i) => i.side === "problem") || !!item.problemUrl;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-background px-3 lg:px-8">
        <Button
          variant="ghost"
          className="h-12 gap-2 px-3 text-item font-bold"
          onClick={() => navigate("/")}
        >
          <X aria-hidden className="size-5" />
          <span className="hidden lg:inline">Close</span>
          <Kbd className="hidden lg:inline-flex">Esc</Kbd>
          <span className="sr-only lg:hidden">Close review</span>
        </Button>
        <div className="flex flex-1 items-center gap-3 lg:justify-center">
          <span className="hidden text-label text-muted-foreground lg:inline">
            {runLabel(run, section.name)}
          </span>
          <span className="shrink-0 font-mono text-meta whitespace-nowrap">
            {number} of {total}
          </span>
          <span
            role="progressbar"
            aria-label="Progress"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={number}
            className="h-1 w-full max-w-60 overflow-hidden rounded-full bg-secondary"
          >
            <span
              className="block h-full rounded-full bg-foreground"
              style={{ width: `${(number / total) * 100}%` }}
            />
          </span>
        </div>
        <span aria-hidden className="hidden w-32 lg:block" />
      </header>

      <main
        onClick={revealOnTap}
        className={cn("flex-1", !session.revealed && "cursor-pointer")}
        aria-live="polite"
      >
        <article className="mx-auto flex max-w-[760px] flex-col gap-5 px-4 py-6 lg:py-8">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <SectionBadge code={section.code} line={section.line} />
            <span className="text-label text-muted-foreground">{section.name}</span>
            <StopIndicator
              stop={item.stop}
              stops={data.ladder.length}
              long
              className="hidden text-muted-foreground lg:inline-flex"
            />
            <StopIndicator
              stop={item.stop}
              stops={data.ladder.length}
              className="text-muted-foreground lg:hidden"
            />
            <Overdue days={daysLate(item.dueOn, data.date)} />
          </p>
          {session.revealed ? (
            <AnswerSide item={item} onZoom={openZoom} />
          ) : (
            <ProblemSide item={item} onZoom={openZoom} />
          )}
        </article>
      </main>

      <div className="sticky bottom-0 z-10">
        {session.revealed ? (
          <RatingDock
            options={options}
            stop={item.stop}
            stops={data.ladder.length}
            today={data.date}
            pickedDate={session.pickedDate}
            pressed={pressed}
            pickerOpen={pickerOpen}
            onPickerOpenChange={setPickerOpen}
            onPick={(date: IsoDate | null) => setSession((s) => pickDate(s, date))}
            onRate={rate}
          />
        ) : (
          <ShowAnswer hint={hasLinksOrImages} onShow={() => setSession(reveal)} />
        )}
      </div>

      <ImageZoom
        images={zoom?.images ?? []}
        index={zoom?.index ?? null}
        onIndexChange={(index) => setZoom((z) => (z ? { ...z, index } : z))}
        onClose={() => setZoom(null)}
      />
    </div>
  );
}

/** Description, then the question: the problem description, or the name when it's empty. */
function ProblemSide({ item, onZoom }: { item: ItemDto; onZoom: (image: ImageDto) => void }) {
  const problemImages = item.images.filter((image) => image.side === "problem");
  return (
    <>
      {item.description && (
        <p className="text-body text-muted-foreground">
          <InlineMarkdown>{item.description}</InlineMarkdown>
        </p>
      )}
      <Question item={item} />
      <ImageGrid images={problemImages} onOpen={onZoom} />
      {item.problemUrl && <ExternalLink url={item.problemUrl} />}
    </>
  );
}

function Question({ item }: { item: ItemDto }) {
  if (item.problemText) {
    return <Markdown className="text-problem-sm lg:text-problem">{item.problemText}</Markdown>;
  }
  return (
    <h1 className="text-heading lg:text-title">
      <InlineMarkdown>{item.name}</InlineMarkdown>
    </h1>
  );
}

/**
 * The problem shrinks to a card with thumbnails, then the name as a heading, the answer, its
 * images and link, and the side note. Empty fields leave no trace.
 */
function AnswerSide({ item, onZoom }: { item: ItemDto; onZoom: (image: ImageDto) => void }) {
  const problemImages = item.images.filter((image) => image.side === "problem");
  const answerImages = item.images.filter((image) => image.side === "answer");
  const hasAnswer = !!(item.answerText || answerImages.length || item.answerUrl || item.sideNote);

  return (
    <>
      {item.problemText ? (
        <section
          aria-label="Problem"
          className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
        >
          {item.description && (
            <p className="text-small text-muted-foreground">
              <InlineMarkdown>{item.description}</InlineMarkdown>
            </p>
          )}
          <Markdown>{item.problemText}</Markdown>
          {(problemImages.length > 0 || item.problemUrl) && (
            <div className="flex flex-wrap items-center gap-4">
              <Thumbnails images={problemImages} onOpen={onZoom} />
              {item.problemUrl && <ExternalLink url={item.problemUrl} />}
            </div>
          )}
        </section>
      ) : (
        <>
          <Question item={item} />
          <Thumbnails images={problemImages} onOpen={onZoom} />
          {item.problemUrl && <ExternalLink url={item.problemUrl} />}
        </>
      )}

      {(item.problemText || hasAnswer) && (
        <div className="flex items-center gap-3 text-label text-muted-foreground">
          Answer <span aria-hidden className="h-px flex-1 bg-border" />
        </div>
      )}
      {item.problemText && (
        <h2 className="text-heading">
          <InlineMarkdown>{item.name}</InlineMarkdown>
        </h2>
      )}
      {item.answerText && <Markdown>{item.answerText}</Markdown>}
      <ImageGrid images={answerImages} onOpen={onZoom} />
      {item.answerUrl && <ExternalLink url={item.answerUrl} />}
      {item.sideNote && (
        <aside className="flex gap-3 rounded-xl border border-border bg-card p-4">
          <Lightbulb aria-hidden className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
          <div className="flex flex-col gap-1">
            <p className="text-label text-muted-foreground">Side note</p>
            <Markdown>{item.sideNote}</Markdown>
          </div>
        </aside>
      )}
    </>
  );
}

function ShowAnswer({ hint, onShow }: { hint: boolean; onShow: () => void }) {
  return (
    <div className="border-t border-border bg-background shadow-dock">
      <div className="mx-auto flex max-w-[760px] flex-col gap-2 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <p className="text-center text-small lg:hidden">
          <strong className="block font-bold">Tap anywhere to show the answer</strong>
          {hint && (
            <span className="text-muted-foreground">Images open zoom · links open as usual</span>
          )}
        </p>
        <Button
          variant="secondary"
          className="h-14 w-full justify-center gap-3 rounded-full text-item font-bold lg:justify-between lg:px-6"
          onClick={onShow}
        >
          <span className="inline-flex items-center gap-3">
            <Eye aria-hidden className="size-5" /> Show answer
          </span>
          <Kbd className="hidden lg:inline-flex">Space</Kbd>
        </Button>
        <p className="hidden text-center text-small text-muted-foreground lg:block">
          Click anywhere to show the answer
          {hint && " · images open zoom (Z) · links open in a new tab"}
        </p>
      </div>
    </div>
  );
}

const REFUSALS = {
  "already-reviewed-today": "Already reviewed today. It comes back on its next date.",
  "picked-date-invalid": "That date doesn’t exist. Pick another.",
  "picked-date-not-after-today": "Pick a date after today.",
  "not-left": "This item isn’t on today’s list any more.",
} as const;

function parseRun(query: URLSearchParams): Run {
  const item = Number(query.get("item"));
  if (Number.isSafeInteger(item) && item > 0) return { kind: "item", itemId: item };
  const section = Number(query.get("section"));
  if (Number.isSafeInteger(section) && section > 0) return { kind: "section", sectionId: section };
  return { kind: "all" };
}

function runKey(run: Run): string {
  return run.kind === "all"
    ? "all"
    : `${run.kind}-${run.kind === "item" ? run.itemId : run.sectionId}`;
}

function runLabel(run: Run, sectionName: string): string {
  if (run.kind === "item") return `Review · ${sectionName}`;
  if (run.kind === "section") return `Flash review · ${sectionName}`;
  return "Flash review · all lines";
}

function queueFor(data: TodayData, run: Run): number[] {
  if (run.kind === "item") return data.items.some((i) => i.id === run.itemId) ? [run.itemId] : [];
  const reviewedToday = new Set(data.reviewsToday.map((r) => r.itemId));
  return reviewQueue(data.items, {
    sections: data.sections,
    reviewedToday,
    today: data.date,
    sectionId: run.kind === "section" ? run.sectionId : undefined,
  }).map((item) => item.id);
}
