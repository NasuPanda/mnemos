import { FlaskConical } from "lucide-react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { DESKTOP, useMediaQuery } from "@/hooks/use-media-query";
import { leaveTutorial, useBannerSlot } from "@/state/tutorial";
import { Tour } from "./tour-view";

/**
 * The practice day above its screens (design plan, First-run tutorial): the practice banner, a
 * River bar with a hairline below and a flask icon, never yellow, since it is information; Skip
 * leaves for the person's own board. And the tour, whose cards walk through the day.
 */
export default function PracticeLayer() {
  const desktop = useMediaQuery(DESKTOP);
  const slot = useBannerSlot();

  const banner = (
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
      <Button
        variant="ghost"
        className="h-12 shrink-0 px-4 text-small font-bold"
        onClick={() => leaveTutorial("skip")}
      >
        {desktop ? "Skip tutorial" : "Skip"}
      </Button>
    </div>
  );
  return (
    <>
      {slot ? createPortal(banner, slot) : banner}
      <Tour />
    </>
  );
}
