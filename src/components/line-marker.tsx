import type { Line } from "@/core";
import { LINE_CLASSES } from "@/lib/line-classes";
import { cn } from "@/lib/utils";

/**
 * An item's station circle in its line's colour; a yellow ring on the row J/K points at, and an
 * Edge ring on a row already reviewed today.
 */
export function LineMarker({
  line,
  selected = false,
  dimmed = false,
  className,
}: {
  line: Line;
  selected?: boolean;
  dimmed?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "size-4 shrink-0 rounded-full border-[3px]",
        selected ? "border-ring" : dimmed ? "border-input" : LINE_CLASSES[line].ring,
        className,
      )}
    />
  );
}
