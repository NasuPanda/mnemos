import { Calendar, FastForward } from "lucide-react";
import { StopIndicator } from "@/components/stop-indicator";
import { count, shortDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CONFIDENCE_LABEL, type HistoryPoint } from "@/state/history-view";

/**
 * Every review, newest first: the accessible view of the line map. The marks are in words:
 * "1 day early" next to the review date, "picked" next to the date it set. A row picks its dot.
 */
export function HistoryTable({
  rows,
  stops,
  compact,
  active,
  onActive,
}: {
  rows: HistoryPoint[];
  stops: number;
  compact: boolean;
  active: number | null;
  onActive: (index: number) => void;
}) {
  return (
    <table className="w-full border-collapse text-left">
      <thead>
        <tr className="text-label text-muted-foreground">
          <th scope="col" className="py-2 pr-3 font-semibold">
            Reviewed
          </th>
          <th scope="col" className="py-2 pr-3 font-semibold">
            Confidence
          </th>
          <th scope="col" className="py-2 pr-3 font-semibold">
            {compact ? "Stop" : "Stop after"}
          </th>
          <th scope="col" className="py-2 font-semibold">
            Next due
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.review.id}
            onClick={() => onActive(row.index)}
            data-active={active === row.index || undefined}
            className={cn(
              "cursor-pointer border-t border-border align-middle",
              active === row.index ? "bg-secondary" : "hover:bg-accent/60",
            )}
          >
            <td className="py-2.5 pr-3">
              <span className="font-mono text-meta whitespace-nowrap lg:text-body">
                {shortDate(row.review.reviewedOn)}
              </span>
              {row.early !== null && (
                <span
                  className={cn(
                    "items-center gap-1 text-small whitespace-nowrap text-muted-foreground",
                    compact ? "flex" : "ml-2 inline-flex",
                  )}
                >
                  <FastForward aria-hidden className="size-3.5" />
                  {count(row.early, "day")} early
                </span>
              )}
            </td>
            <td className="py-2.5 pr-3 text-small lg:text-body">
              {CONFIDENCE_LABEL[row.review.confidence]}
            </td>
            <td className="py-2.5 pr-3">
              <StopIndicator stop={row.stop} stops={stops} bare className="text-muted-foreground" />
            </td>
            <td className="py-2.5">
              <span className="font-mono text-meta whitespace-nowrap lg:text-body">
                {shortDate(row.review.nextDueOn)}
              </span>
              {row.picked && (
                <span className="ml-2 inline-flex items-center gap-1 text-small whitespace-nowrap text-muted-foreground">
                  <Calendar aria-hidden className="size-3.5" />
                  picked
                </span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
