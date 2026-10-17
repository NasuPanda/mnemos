import { cn } from "@/lib/utils";

/**
 * Where an item is on the ladder: one square per stop, filled up to the current one, always
 * with text. Squares are the ladder's shape everywhere. "4/7" in rows, "Stop 4 of 7" in review.
 */
export function StopIndicator({
  stop,
  stops,
  long = false,
  bare = false,
  dimmed = false,
  className,
}: {
  stop: number;
  stops: number;
  long?: boolean;
  /** Just the number after the squares, as in the history table: "■■■■□□□ 4". */
  bare?: boolean;
  /** Fog squares, for a row already reviewed today. */
  dimmed?: boolean;
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label={`Stop ${stop} of ${stops}`}
      className={cn("inline-flex items-center gap-1.5 whitespace-nowrap", className)}
    >
      <span aria-hidden className="inline-flex gap-0.5">
        {Array.from({ length: stops }, (_, index) => (
          <span
            key={index}
            className={cn(
              "size-[7px] rounded-[1px]",
              index >= stop
                ? "border border-stop-empty"
                : dimmed
                  ? "bg-subtle-foreground"
                  : "bg-stop-filled",
            )}
          />
        ))}
      </span>
      <span aria-hidden className={cn(long ? "font-sans text-label" : "font-mono text-meta")}>
        {long ? `Stop ${stop} of ${stops}` : bare ? stop : `${stop}/${stops}`}
      </span>
    </span>
  );
}
