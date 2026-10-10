import { CalendarDays, X } from "lucide-react";
import type { Confidence, IsoDate, RatingOption } from "@/core";
import { StopIndicator } from "@/components/stop-indicator";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { DESKTOP, useMediaQuery } from "@/hooks/use-media-query";
import { shortDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PickDate } from "./pick-date";

const LABELS: Record<Confidence, string> = {
  confident: "Confident",
  neutral: "Neutral",
  not_at_all: "Not at all",
};

/**
 * The three confidence buttons, each with the date and stop it leads to, plus Pick a date.
 * Desktop: side by side with keys 1 2 3. Phone: stacked, 56 px, at the bottom in thumb reach.
 */
export function RatingDock({
  options,
  stop,
  stops,
  today,
  pickedDate,
  pressed,
  pickerOpen,
  onPickerOpenChange,
  onPick,
  onRate,
}: {
  options: RatingOption[];
  stop: number;
  stops: number;
  today: IsoDate;
  pickedDate: IsoDate | null;
  /** The button that was just pressed: yellow for 120 ms, then the next item. */
  pressed: Confidence | null;
  pickerOpen: boolean;
  onPickerOpenChange: (open: boolean) => void;
  onPick: (date: IsoDate | null) => void;
  onRate: (confidence: Confidence) => void;
}) {
  const confidentLands = options[0]?.nextDueOn ?? today;
  const onLastStop = stop === stops;
  const desktop = useMediaQuery(DESKTOP);

  const pickButton = pickedDate ? (
    <span className="inline-flex h-12 items-center gap-2 rounded-full bg-secondary pr-1 pl-4 text-label">
      <CalendarDays aria-hidden className="size-4" />
      Date picked: {shortDate(pickedDate)}
      <Button
        variant="ghost"
        size="icon"
        className="size-10 rounded-full"
        aria-label="Clear the picked date"
        onClick={() => onPick(null)}
      >
        <X aria-hidden className="size-4" />
      </Button>
    </span>
  ) : (
    <Button
      variant="ghost"
      className="h-12 gap-2 px-3 text-item font-bold"
      onClick={() => onPickerOpenChange(true)}
    >
      <CalendarDays aria-hidden className="size-5" />
      <span className="lg:hidden">Pick a date</span>
      <span className="hidden lg:inline">Pick a date…</span>
      <Kbd>D</Kbd>
    </Button>
  );

  // One picker, placed where the layout puts Pick a date: above the buttons below 1024 px.
  const picker = (
    <PickDate
      open={pickerOpen}
      onOpenChange={onPickerOpenChange}
      today={today}
      confidentLands={confidentLands}
      picked={pickedDate}
      onPick={onPick}
    >
      {pickButton}
    </PickDate>
  );

  return (
    <div className="border-t border-border bg-background shadow-dock">
      <div className="mx-auto flex max-w-[760px] flex-col gap-3 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] lg:pt-4">
        {/* Phone: "Now on" and Pick a date above the buttons; a picked date takes the row. */}
        <div className="flex items-center justify-between gap-3 lg:hidden">
          {!pickedDate && (
            <span className="inline-flex items-center gap-2 text-small whitespace-nowrap text-muted-foreground">
              Now on <StopIndicator stop={stop} stops={stops} />
            </span>
          )}
          {!desktop && picker}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {options.map((option, index) => {
            const date = pickedDate ?? option.nextDueOn;
            return (
              <button
                key={option.confidence}
                type="button"
                onClick={() => onRate(option.confidence)}
                className={cn(
                  "flex h-14 items-center justify-between gap-3 rounded-lg bg-secondary px-5 text-secondary-foreground transition-colors duration-100 hover:bg-accent sm:h-auto sm:flex-col sm:items-stretch sm:gap-1 sm:py-3",
                  pressed === option.confidence &&
                    "bg-primary text-primary-foreground hover:bg-primary",
                )}
              >
                <span className="flex items-center justify-between">
                  <span className="text-item font-bold">{LABELS[option.confidence]}</span>
                  <Kbd className="hidden sm:inline-flex">{index + 1}</Kbd>
                </span>
                <span className="font-mono text-meta sm:text-left">
                  {shortDate(date)} · stop {option.stopAfter}
                </span>
              </button>
            );
          })}
        </div>

        {/* Desktop: Pick a date and the ladder rule under the buttons. */}
        <div className="hidden items-center gap-4 lg:flex">
          {desktop && picker}
          <p className="text-small text-muted-foreground">
            {onLastStop
              ? "Already on the last stop: Confident and Neutral keep it there · Not at all goes back to stop 1"
              : "Confident moves up one stop · Neutral stays · Not at all goes back to stop 1"}
          </p>
        </div>
      </div>
    </div>
  );
}
