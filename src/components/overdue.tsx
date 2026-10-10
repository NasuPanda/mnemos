import { Clock } from "lucide-react";
import { cn } from "cn";
import { lateLabel } from "@/lib/format";

/** "+3 days" with a clock: bold text, no colour. Nothing shows for an item due today. */
export function Overdue({ days, className }: { days: number; className?: string }) {
  if (days <= 0) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-label font-bold text-foreground",
        className,
      )}
    >
      <Clock aria-hidden className="size-3.5" />
      {lateLabel(days)}
    </span>
  );
}
