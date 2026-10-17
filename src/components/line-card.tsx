import { Calendar, Check, FastForward, ImageIcon, Play } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { reviewTiming, type Confidence, type DayEntry } from "@/core";
import { Link } from "@/components/link";
import { LineMarker } from "@/components/line-marker";
import { LINE_CLASSES } from "@/lib/line-classes";
import { count } from "@/lib/format";
import { InlineMarkdown } from "@/components/markdown";
import { Overdue } from "@/components/overdue";
import { SectionBadge } from "@/components/section-badge";
import { StopIndicator } from "@/components/stop-indicator";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import type { ItemDto, PastReviewDto, SectionDto } from "../../worker/contract";

/**
 * One section drawn as a metro line: its items (or a past day's reviews) are stations. The
 * header counts them; its button reviews the line, and is left out when there is nothing to
 * review.
 */
export function LineCard({
  section,
  summary,
  reviewHref,
  shiftHint = false,
  children,
}: {
  section: SectionDto;
  /** "8 left · 3 late", "2 due · 1 reviewed today", "3 reviewed". */
  summary: string;
  reviewHref?: string;
  /** Shift+F reviews the line with the selected row. */
  shiftHint?: boolean;
  children: ReactNode;
}) {
  return (
    <Card className="gap-0 rounded-xl bg-card px-3 pt-3 pb-2 shadow-card ring-0">
      <header className="flex min-h-12 items-center gap-3 px-1">
        <SectionBadge code={section.code} line={section.line} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-section">{section.name}</h2>
          <p className="font-mono text-meta text-muted-foreground">{summary}</p>
        </div>
        {shiftHint && reviewHref && (
          <KbdGroup aria-hidden className="hidden lg:inline-flex">
            <Kbd>Shift</Kbd>
            <Kbd>F</Kbd>
          </KbdGroup>
        )}
        {reviewHref && (
          <Button
            asChild
            variant="secondary"
            size="icon"
            className="size-12 rounded-full"
            aria-label={`Review ${section.name}`}
          >
            <Link to={reviewHref}>
              <Play aria-hidden className="size-5" />
            </Link>
          </Button>
        )}
      </header>
      <ol className="mt-2">{children}</ol>
    </Card>
  );
}

/**
 * A station on the line: the rail between stations, drawn behind the circle, then the row. A
 * row with `to` is a link; with `onOpen` a button; otherwise (reviewed today) plain text.
 */
export function Station({
  section,
  rowId,
  first,
  last,
  selected = false,
  dimmed = false,
  to,
  onOpen,
  label,
  children,
}: {
  section: SectionDto;
  /** Lets J/K scroll the row into view. */
  rowId: number;
  first: boolean;
  last: boolean;
  selected?: boolean;
  dimmed?: boolean;
  to?: string;
  onOpen?: () => void;
  /** What a screen reader hears for a button row. */
  label?: string;
  children: ReactNode;
}) {
  const colours = LINE_CLASSES[section.line];
  const className = cn(
    "relative flex min-h-14 w-full gap-3 rounded-lg py-2 pr-2 pl-2.5 text-left",
    (to || onOpen) && "hover:bg-accent/60",
    selected && "bg-secondary hover:bg-secondary",
  );
  const content = (
    <>
      <LineMarker
        line={section.line}
        selected={selected}
        dimmed={dimmed}
        className={cn("mt-[5px]", selected ? "bg-secondary" : "bg-card")}
      />
      <span className="flex min-w-0 flex-col gap-1">{children}</span>
    </>
  );
  const shared = {
    "data-row-id": rowId,
    "aria-current": selected ? ("true" as const) : undefined,
    className,
  };
  return (
    <li className="relative">
      {!(first && last) && (
        <span
          aria-hidden
          className={cn(
            "absolute left-[17px] w-[3px]",
            colours.rail,
            first ? "top-5" : "top-0",
            last ? "h-5" : "bottom-0",
          )}
        />
      )}
      {to ? (
        <Link to={to} {...shared}>
          {content}
        </Link>
      ) : onOpen ? (
        <button type="button" onClick={onOpen} aria-label={label} {...shared}>
          {content}
        </button>
      ) : (
        <div {...shared}>{content}</div>
      )}
    </li>
  );
}

/** An item's row: its name, stop, how late it is and its images; or "Reviewed today", dimmed. */
export function ItemRow({ entry, stops }: { entry: DayEntry<ItemDto>; stops: number }) {
  const { item, reviewedToday } = entry;
  const images = item.images.length;
  return (
    <>
      <span className={cn("text-item lg:text-item-sm", reviewedToday && "text-subtle-foreground")}>
        <InlineMarkdown>{item.name}</InlineMarkdown>
      </span>
      <span
        className={cn(
          "flex flex-wrap items-center gap-x-3 gap-y-1",
          reviewedToday ? "text-subtle-foreground" : "text-muted-foreground",
        )}
      >
        <StopIndicator stop={item.stop} stops={stops} dimmed={reviewedToday} />
        <Overdue days={entry.daysLate} />
        {reviewedToday ? (
          <span className="inline-flex items-center gap-1 text-label">
            <Check aria-hidden className="size-3.5" />
            Reviewed today
          </span>
        ) : (
          images > 0 && (
            <span className="inline-flex items-center gap-1 font-mono text-meta">
              <ImageIcon aria-hidden className="size-3.5" />
              <span className="sr-only">Images:</span>
              {images}
            </span>
          )
        )}
      </span>
    </>
  );
}

const CONFIDENCE: Record<Confidence, string> = {
  confident: "Confident",
  neutral: "Neutral",
  not_at_all: "Not at all",
};

/** A past day's review: the name, the stop it moved to, the confidence and its marks. */
export function ReviewRow({ review, stops }: { review: PastReviewDto; stops: number }) {
  const timing = reviewTiming(review);
  return (
    <>
      <span className="text-item lg:text-item-sm">
        <InlineMarkdown>{review.name}</InlineMarkdown>
      </span>
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
        <StopIndicator stop={review.stopAfter} stops={Math.max(stops, review.stopAfter)} />
        <span className="text-label">{CONFIDENCE[review.confidence]}</span>
        {timing.kind === "early" && (
          <span className="inline-flex items-center gap-1 text-label">
            <FastForward aria-hidden className="size-3.5" />
            {count(timing.days, "day")} early
          </span>
        )}
        {review.manual && (
          <span className="inline-flex items-center gap-1 text-label">
            <Calendar aria-hidden className="size-3.5" />
            picked
          </span>
        )}
      </span>
    </>
  );
}
