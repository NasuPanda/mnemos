import type { Line } from "@/core";
import { LINE_CLASSES } from "@/lib/line-classes";
import { cn } from "@/lib/utils";

/** An item's station circle in its line's colour; a yellow ring on the row J/K points at. */
export function LineMarker({
  line,
  selected = false,
  className,
}: {
  line: Line;
  selected?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "size-4 shrink-0 rounded-full border-[3px]",
        selected ? "border-ring" : LINE_CLASSES[line].ring,
        className,
      )}
    />
  );
}
