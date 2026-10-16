import { Check } from "lucide-react";
import type { ItemStatus } from "@/core";
import { Overdue } from "@/components/overdue";
import { cn } from "@/lib/utils";

/** "+3 days", "Due today" or "Reviewed today": words, weight and an icon, never colour. */
export function ItemStatusLabel({ status, className }: { status: ItemStatus; className?: string }) {
  switch (status.kind) {
    case "late":
      return <Overdue days={status.days} className={className} />;
    case "due-today":
      return (
        <span className={cn("text-label font-bold text-foreground", className)}>Due today</span>
      );
    case "reviewed-today":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1 text-small text-muted-foreground",
            className,
          )}
        >
          <Check aria-hidden className="size-3.5" />
          Reviewed today
        </span>
      );
    case "scheduled":
      return null;
  }
}
