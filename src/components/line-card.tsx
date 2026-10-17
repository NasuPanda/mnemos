import { ImageIcon, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DayEntry } from "@/core";
import { Link } from "@/components/link";
import { LineMarker } from "@/components/line-marker";
import { LINE_CLASSES } from "@/lib/line-classes";
import { InlineMarkdown } from "@/components/markdown";
import { Overdue } from "@/components/overdue";
import { SectionBadge } from "@/components/section-badge";
import { StopIndicator } from "@/components/stop-indicator";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import type { ItemDto, SectionDto } from "../../worker/contract";

/**
 * One section drawn as a metro line: its items are stations, each with its stop and how late
 * it is. The row J/K points at lifts to Swell and its circle turns into a yellow ring.
 */
export function LineCard({
  section,
  entries,
  late,
  stops,
  selectedId,
  reviewHref,
}: {
  section: SectionDto;
  entries: DayEntry<ItemDto>[];
  late: number;
  stops: number;
  selectedId: number | null;
  reviewHref: string;
}) {
  const colours = LINE_CLASSES[section.line];
  const hasSelection = entries.some((entry) => entry.item.id === selectedId);
  return (
    <Card className="gap-0 rounded-xl bg-card px-3 pt-3 pb-2 shadow-card ring-0">
      <header className="flex items-center gap-3 px-1">
        <SectionBadge code={section.code} line={section.line} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-section">{section.name}</h2>
          <p className="font-mono text-meta text-muted-foreground">
            {entries.length} left{late > 0 ? ` · ${late} late` : ""}
          </p>
        </div>
        {hasSelection && (
          <KbdGroup aria-hidden className="hidden lg:inline-flex">
            <Kbd>Shift</Kbd>
            <Kbd>F</Kbd>
          </KbdGroup>
        )}
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
      </header>

      <ol className="mt-2">
        {entries.map((entry, index) => {
          const selected = entry.item.id === selectedId;
          const first = index === 0;
          const last = index === entries.length - 1;
          const images = entry.item.images.length;
          return (
            <li key={entry.item.id} className="relative">
              {/* The line between stations, drawn behind the circles. */}
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
              <Link
                to={`/review?item=${entry.item.id}`}
                data-item-id={entry.item.id}
                aria-current={selected ? "true" : undefined}
                className={cn(
                  "relative flex min-h-14 gap-3 rounded-lg py-2 pr-2 pl-2.5 hover:bg-accent/60",
                  selected && "bg-secondary hover:bg-secondary",
                )}
              >
                <LineMarker
                  line={section.line}
                  selected={selected}
                  className={cn("mt-[5px]", selected ? "bg-secondary" : "bg-card")}
                />
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="text-item lg:text-item-sm">
                    <InlineMarkdown>{entry.item.name}</InlineMarkdown>
                  </span>
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
                    <StopIndicator stop={entry.item.stop} stops={stops} />
                    <Overdue days={entry.daysLate} />
                    {images > 0 && (
                      <span className="inline-flex items-center gap-1 font-mono text-meta">
                        <ImageIcon aria-hidden className="size-3.5" />
                        <span className="sr-only">Images:</span>
                        {images}
                      </span>
                    )}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
