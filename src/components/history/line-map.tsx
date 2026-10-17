import { Calendar, FastForward } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Line } from "@/core";
import { lateLabel, shortDate } from "@/lib/format";
import { LINE_CLASSES } from "@/lib/line-classes";
import { cn } from "@/lib/utils";
import { axisDate, axisDay, type HistoryView } from "@/state/history-view";

/** Layout in px. The phone shows the latest 10 reviews, desktop up to 20; older ones scroll. */
const LAYOUT = {
  desktop: { row: 38, axis: 44, top: 36, bottom: 30, label: 190, visible: 20, col: [44, 76] },
  phone: { row: 26, axis: 30, top: 30, bottom: 28, label: 12, visible: 10, col: [28, 40] },
} as const;

/**
 * The line map: reviews left to right, ladder stops bottom to top (square markers), the line in
 * the section's colour stepping up for Confident, flat for Neutral, down to 1 for Not at all.
 * Dots are sized by confidence; marks above them show a picked date and an early review. Today
 * is a hairline, not a dot. A dot shows its details on hover, focus or tap.
 */
export function LineMap({
  view,
  line,
  compact,
  active,
  onActive,
}: {
  view: HistoryView;
  line: Line;
  /** The phone's narrower map: icons without words, day numbers without months. */
  compact: boolean;
  /** The review whose details show, by index; null for none. */
  active: number | null;
  onActive: (index: number | null) => void;
}) {
  const layout = compact ? LAYOUT.phone : LAYOUT.desktop;
  const scroller = useRef<HTMLDivElement>(null);
  const width = useWidth(scroller);
  const { points, stops, now } = view;

  const columns = points.length + 1; // one more for Today
  const fit = (width - layout.label) / Math.min(columns, layout.visible + 1);
  const col = Math.min(Math.max(fit || layout.col[1], layout.col[0]), layout.col[1]);
  const x = (index: number) => col / 2 + index * col;
  const y = (stop: number) => layout.top + (stops - stop) * layout.row;
  const todayX = x(points.length);
  const height = y(1) + layout.bottom;
  const contentWidth = Math.max(width, todayX + col / 2 + layout.label);

  // Start at the latest reviews; older ones are a scroll back.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [points.length, width]);

  const last = points.at(-1);
  const path = points.length
    ? points
        .map((p, i) => (i === 0 ? `M ${x(0)} ${y(p.stop)}` : `H ${x(i)} V ${y(p.stop)}`))
        .join(" ") + ` H ${todayX}${last && last.stop !== now.stop ? ` V ${y(now.stop)}` : ""}`
    : "";
  const shown = active === null ? null : points[active];

  return (
    <div className="flex">
      {/* The stops stay put while the reviews scroll. */}
      <svg aria-hidden width={layout.axis} height={height} className="shrink-0 overflow-visible">
        {Array.from({ length: stops }, (_, i) => i + 1).map((stop) => (
          <g key={stop} transform={`translate(${layout.axis / 2 - 8} ${y(stop) - 8})`}>
            <rect
              width={16}
              height={16}
              rx={2}
              className="fill-background stroke-foreground"
              strokeWidth={1.5}
            />
            <text
              x={8}
              y={12}
              textAnchor="middle"
              className="fill-foreground font-mono text-[0.75rem] font-semibold"
            >
              {stop}
            </text>
          </g>
        ))}
      </svg>

      <div ref={scroller} className="min-w-0 flex-1 overflow-x-auto overscroll-x-contain">
        <div className="relative" style={{ width: contentWidth, height }}>
          <svg aria-hidden width={contentWidth} height={height} className="absolute inset-0">
            {Array.from({ length: stops }, (_, i) => i + 1).map((stop) => (
              <line
                key={stop}
                x1={0}
                x2={contentWidth}
                y1={y(stop)}
                y2={y(stop)}
                className="stroke-border"
              />
            ))}
            <line
              x1={todayX}
              x2={todayX}
              y1={layout.top - 16}
              y2={y(1)}
              className="stroke-muted-foreground"
            />
            {path && (
              <path
                d={path}
                fill="none"
                strokeWidth={3}
                strokeLinejoin="round"
                className={LINE_CLASSES[line].stroke}
              />
            )}
          </svg>

          {points.map((p) => (
            <Marks key={`m${p.index}`} point={p} x={x(p.index)} y={y(p.stop)} compact={compact} />
          ))}

          {points.map((p) => (
            <button
              key={p.index}
              type="button"
              aria-label={`${p.title}, ${p.detail}`}
              aria-pressed={active === p.index}
              onClick={() => onActive(p.index)}
              onFocus={() => onActive(p.index)}
              onMouseEnter={() => onActive(p.index)}
              className={cn(
                "absolute rounded-full before:absolute before:-inset-3 before:content-['']",
                LINE_CLASSES[line].rail,
                active === p.index && "outline-2 outline-offset-[3px] outline-ring outline-solid",
              )}
              style={{
                left: x(p.index) - p.size / 2,
                top: y(p.stop) - p.size / 2,
                width: p.size,
                height: p.size,
              }}
            />
          ))}

          {points.map((p) => (
            <span
              key={`d${p.index}`}
              aria-hidden
              className="absolute -translate-x-1/2 font-mono text-[0.75rem] whitespace-nowrap text-muted-foreground"
              style={{ left: x(p.index), top: y(1) + 12 }}
            >
              {compact ? axisDay(p.review.reviewedOn) : axisDate(p.review.reviewedOn)}
            </span>
          ))}
          <span
            aria-hidden
            className="absolute -translate-x-1/2 text-[0.75rem] font-bold whitespace-nowrap text-foreground"
            style={{ left: todayX, top: y(1) + 12 }}
          >
            Today
          </span>

          {!compact && (
            <span
              className="absolute flex flex-col whitespace-nowrap"
              style={{ left: todayX + 14, top: y(now.stop) - 22 }}
            >
              <span className="text-label">
                On stop {now.stop}
                {now.since && ` since ${axisDate(now.since)}`}
              </span>
              <span className="text-small text-muted-foreground">
                due {shortDate(now.dueOn)}
                {now.daysLate > 0 && ` · ${lateLabel(now.daysLate)}`}
              </span>
            </span>
          )}

          {shown && (
            <div
              role="status"
              className={cn(
                "pointer-events-none absolute z-10 rounded-md border border-border bg-popover px-3 py-2 whitespace-nowrap shadow-raised",
                x(shown.index) > contentWidth - 240 && "-translate-x-full",
              )}
              style={{
                left: x(shown.index) + (x(shown.index) > contentWidth - 240 ? -14 : 14),
                top: y(shown.stop) + 14,
              }}
            >
              <p className="text-label">{shown.title}</p>
              <p className="font-mono text-meta text-muted-foreground">{shown.detail}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** The calendar "picked" and ⏩ "1 day early" marks above a dot; the phone shows the icons only. */
function Marks({
  point,
  x,
  y,
  compact,
}: {
  point: HistoryView["points"][number];
  x: number;
  y: number;
  compact: boolean;
}) {
  if (!point.picked && point.early === null) return null;
  return (
    <span
      aria-hidden
      className="absolute flex -translate-x-1/2 -translate-y-full items-center gap-2 text-small whitespace-nowrap"
      style={{ left: x, top: y - point.size / 2 - 6 }}
    >
      {point.early !== null && (
        <span className="inline-flex items-center gap-1">
          <FastForward className="size-3.5" />
          {!compact && `${point.early} day${point.early === 1 ? "" : "s"} early`}
        </span>
      )}
      {point.picked && (
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <Calendar className="size-3.5" />
          {!compact && "picked"}
        </span>
      )}
    </span>
  );
}

/** The width of an element, kept up to date. 0 until it has been measured. */
function useWidth(ref: React.RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry?.contentRect.width ?? 0));
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}
