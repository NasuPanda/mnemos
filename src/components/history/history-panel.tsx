import { Calendar, FastForward } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { InlineMarkdown } from "@/components/markdown";
import { Overdue } from "@/components/overdue";
import { SectionBadge } from "@/components/section-badge";
import { StopIndicator } from "@/components/stop-indicator";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { DESKTOP, useMediaQuery } from "@/hooks/use-media-query";
import { getJson } from "@/lib/api";
import { shortDate } from "@/lib/format";
import { LINE_CLASSES } from "@/lib/line-classes";
import { useBackCloses, useLocation } from "@/lib/router";
import { useToday } from "@/lib/today";
import { cn } from "@/lib/utils";
import { closeHistory, useHistoryTarget, type HistoryTarget } from "@/state/history-panel";
import { DOT_SIZE, historyView } from "@/state/history-view";
import { useTodayState } from "@/state/today-store";
import type { ItemHistoryResponse } from "../../../worker/contract";
import { HistoryTable } from "./history-table";
import { LineMap } from "./line-map";

/**
 * An item's history over whatever screen it was opened from: a dialog on desktop, a tall sheet
 * on the phone. Esc, Back and ✕ close it, and the screen behind is exactly as it was.
 */
export function HistoryPanel() {
  const target = useHistoryTarget();
  const desktop = useMediaQuery(DESKTOP);
  const { path } = useLocation();
  const open = target !== null;
  useBackCloses(open, closeHistory);

  // Leaving the screen leaves its history too.
  useEffect(() => closeHistory(), [path]);

  const description = "Reviews left to right, stops bottom to top; the table lists them all.";
  const body = target && <HistoryBody key={target.itemId} target={target} compact={!desktop} />;

  if (desktop) {
    return (
      <Dialog open={open} onOpenChange={(next) => !next && closeHistory()}>
        <DialogContent className="max-h-[90dvh] max-w-[880px]! gap-5 overflow-y-auto rounded-lg p-6 shadow-overlay">
          <DialogDescription className="sr-only">{description}</DialogDescription>
          {body}
        </DialogContent>
      </Dialog>
    );
  }
  return (
    <Drawer open={open} onOpenChange={(next) => !next && closeHistory()}>
      <DrawerContent className="max-h-[92dvh] outline-none">
        <DrawerDescription className="sr-only">{description}</DrawerDescription>
        <div className="overflow-y-auto px-4 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {body}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function HistoryBody({ target, compact }: { target: HistoryTarget; compact: boolean }) {
  const today = useToday();
  const todayState = useTodayState(today);
  const [history, setHistory] = useState<ItemHistoryResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    let current = true;
    getJson<ItemHistoryResponse>(`/api/items/${target.itemId}/history`)
      .then((data) => current && setHistory(data))
      .catch(() => current && setFailed(true));
    return () => {
      current = false;
    };
  }, [target.itemId]);

  const data = todayState.status === "ready" ? todayState.data : null;
  const view = useMemo(
    () => (history && data ? historyView(history, data.ladder, today) : null),
    [history, data, today],
  );
  const section = data?.sections.find((s) => s.id === history?.item.sectionId);
  const Title = compact ? DrawerTitle : DialogTitle;

  if (failed) {
    return (
      <div className="flex flex-col gap-3">
        <Title className="text-heading">History</Title>
        <p className="text-body text-muted-foreground">
          The history didn’t load. Check your connection, then try again.
        </p>
      </div>
    );
  }
  if (!view || !history || !data || !section) {
    return <Title className="sr-only">History</Title>;
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 pr-8">
        <Title className="flex min-w-0 items-center gap-3 text-section">
          <SectionBadge code={section.code} line={section.line} />
          {target.hideName ? (
            <span className="sr-only">History</span>
          ) : (
            <span className="min-w-0">
              <span className="sr-only">History of </span>
              <InlineMarkdown>{history.item.name}</InlineMarkdown>
            </span>
          )}
        </Title>
        <p className="flex items-center gap-3 text-muted-foreground">
          <StopIndicator stop={view.now.stop} stops={data.ladder.length} long={!compact} />
          <Overdue days={view.now.daysLate} />
        </p>
      </header>

      {view.points.length === 0 ? (
        <p className="text-body text-muted-foreground">
          No reviews yet. It’s due {shortDate(view.now.dueOn)}.
        </p>
      ) : (
        <>
          <LineMap
            view={view}
            line={section.line}
            compact={compact}
            active={active}
            onActive={setActive}
          />
          <Legend line={section.line} />
          <HistoryTable
            rows={view.rows}
            stops={view.stops}
            compact={compact}
            active={active}
            onActive={setActive}
          />
          {compact && (
            <p className="text-small text-muted-foreground">Tap a dot or a row for its details.</p>
          )}
        </>
      )}
    </div>
  );
}

/** Confident, Neutral and Not at all by dot size; the two marks; the ladder's squares. */
function Legend({ line }: { line: Parameters<typeof LineMap>[0]["line"] }) {
  const dot = (size: number) => (
    <span
      aria-hidden
      className={cn("inline-block rounded-full", LINE_CLASSES[line].rail)}
      style={{ width: size, height: size }}
    />
  );
  return (
    <ul aria-label="Legend" className="flex flex-wrap items-center gap-x-5 gap-y-2 text-small">
      <li className="inline-flex items-center gap-2">{dot(DOT_SIZE.confident)} Confident</li>
      <li className="inline-flex items-center gap-2">{dot(DOT_SIZE.neutral)} Neutral</li>
      <li className="inline-flex items-center gap-2">{dot(DOT_SIZE.not_at_all)} Not at all</li>
      <li className="inline-flex items-center gap-2 text-muted-foreground">
        <Calendar aria-hidden className="size-4" /> date picked by you
      </li>
      <li className="inline-flex items-center gap-2 text-muted-foreground">
        <FastForward aria-hidden className="size-4" /> reviewed early
      </li>
      <li className="inline-flex items-center gap-2 text-muted-foreground">
        <span
          aria-hidden
          className="inline-block size-3.5 rounded-[2px] border-[1.5px] border-foreground"
        />
        ladder stop
      </li>
    </ul>
  );
}
