import { FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DESKTOP, useMediaQuery } from "@/hooks/use-media-query";
import { useLocation } from "@/lib/router";
import { useToday } from "@/lib/today";
import { todayView } from "@/state/today-data";
import { useTodayState } from "@/state/today-store";
import { leaveTutorial } from "@/state/tutorial";

/**
 * The practice banner, above every practice screen's own header (design plan, First-run
 * tutorial): a River bar with a hairline below and a flask icon, never yellow, since it is
 * information. Skip leaves for the person's own board. Once the run is done, All done offers
 * Go to my dashboard here instead, until the tour's closing card takes its place (issue #29).
 */
export default function PracticeLayer() {
  const desktop = useMediaQuery(DESKTOP);
  const done = useRunDone();

  return (
    <div
      role="region"
      aria-label="Practice day"
      className="flex min-h-14 items-center gap-3 border-b border-border bg-card px-4 py-1 lg:px-6"
    >
      <FlaskConical aria-hidden className="size-5 shrink-0 text-muted-foreground" />
      <p className="min-w-0 flex-1 text-small text-muted-foreground">
        <span className="font-bold text-foreground">Practice day</span>
        {desktop
          ? " · sample lines and items. Nothing here is saved, and you can leave any time."
          : " · nothing here is saved"}
      </p>
      {done ? (
        <Button
          variant="secondary"
          className="h-12 shrink-0 px-4 text-small font-bold"
          onClick={() => leaveTutorial("finish")}
        >
          Go to my dashboard
        </Button>
      ) : (
        <Button
          variant="ghost"
          className="h-12 shrink-0 px-4 text-small font-bold"
          onClick={() => leaveTutorial("skip")}
        >
          {desktop ? "Skip tutorial" : "Skip"}
        </Button>
      )}
    </div>
  );
}

/** Whether the practice dashboard shows All done: today's run has nothing left. */
function useRunDone(): boolean {
  const { path, query } = useLocation();
  const today = useToday();
  const state = useTodayState(today);
  if (path !== "/" || (query.get("day") ?? today) !== today) return false;
  return state.status === "ready" && todayView(state.data).counts.left === 0;
}
