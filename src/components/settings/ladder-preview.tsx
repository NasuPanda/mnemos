import { ratingOptions, type IsoDate, type Ladder } from "@/core";
import { StopIndicator } from "@/components/stop-indicator";
import { count, shortDate } from "@/lib/format";

const LABELS = { confident: "Confident", neutral: "Neutral", not_at_all: "Not at all" } as const;

/** "From stop 4, rated today": where each rating leads, with today's ladder. */
export function LadderPreview({
  ladder,
  stop,
  today,
}: {
  ladder: Ladder;
  stop: number;
  today: IsoDate;
}) {
  const options = ratingOptions(stop, ladder, today);
  return (
    <section aria-labelledby="preview-title" className="rounded-xl bg-card p-4 shadow-card lg:p-6">
      <h2 id="preview-title" className="text-section">
        From stop {stop}, rated today
      </h2>
      <dl className="mt-3">
        {options.map((option) => (
          <div
            key={option.confidence}
            className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border py-3 last:border-0"
          >
            <dt className="w-24 text-label">{LABELS[option.confidence]}</dt>
            <dd className="flex flex-1 flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <StopIndicator
                stop={option.stopAfter}
                stops={ladder.length}
                long
                className="text-muted-foreground"
              />
              <span className="font-mono text-meta whitespace-nowrap">
                {shortDate(option.nextDueOn)} · {count(option.gapDays, "day")}
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
