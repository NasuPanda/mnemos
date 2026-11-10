import { useContext, useEffect, useId, useRef, type ReactNode } from "react";
import type { ArrowRenderProps, TooltipRenderProps } from "react-joyride";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { modKey } from "@/lib/keys";
import { cn } from "@/lib/utils";
import { requestReveal } from "@/state/tutorial";
import { TourContext } from "./tour-context";
import { copyParts, touchCopy, type TourStep } from "./tour-steps";

/** How the person last moved: the focus ring shows on the card only after keys. */
let lastInput: "keys" | "pointer" = "pointer";
if (typeof window !== "undefined") {
  window.addEventListener("keydown", () => (lastInput = "keys"), { capture: true });
  window.addEventListener("pointerdown", () => (lastInput = "pointer"), { capture: true });
}

/** Each step's width: 360 px, wider under wide targets; the phone's screen width minus 24 px. */
const WIDE = new Set(["sides", "rate", "reveal"]);

/**
 * The tour's card (design plan, First-run tutorial, "The card"), drawn by react-joyride where the
 * step says. Explain cards are modal dialogs that hold the focus, with Back and Next; Act cards
 * are a polite status with Skip only, and the app keeps the focus; the closing card has Go to my
 * dashboard and no Skip.
 */
export function TourCard({ step }: TooltipRenderProps) {
  const tour = useContext(TourContext)!;
  const def = step.data as TourStep;
  const explain = def.kind !== "act";
  const closing = def.kind === "closing";
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const textId = useId();
  const primary = closing ? tour.onFinish : tour.onNext;

  // Explain: the focus moves into the card and stays there. Enter is Next (or Go to my
  // dashboard), Esc is Skip, and the app's own keys wait.
  useEffect(() => {
    if (!explain) return;
    const card = ref.current;
    // The focus ring shows when the person uses keys, not after a tap or a click.
    card
      ?.querySelector<HTMLElement>("[data-tour-primary]")
      ?.focus({ preventScroll: true, focusVisible: lastInput === "keys" } as FocusOptions);
    const onKey = (event: KeyboardEvent) => {
      if (!card) return;
      const onButton = event.target instanceof Element && !!event.target.closest("button");
      if (event.key === "Escape" && !closing) {
        event.preventDefault();
        tour.onSkip();
      } else if (event.key === "Enter" && !onButton) {
        event.preventDefault();
        primary();
      } else if (event.key === "Tab") {
        event.preventDefault();
        cycleFocus(card, event.shiftKey);
      }
      // Whatever the key, it belongs to the card, not to the dimmed app behind it.
      event.stopPropagation();
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
    // The handlers change every render; the step is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [def.id, explain]);

  const wide = WIDE.has(def.id);
  return (
    <div
      ref={ref}
      data-slot={explain ? "tour-card" : undefined}
      data-state="open"
      data-tour-card={def.id}
      role={explain ? "dialog" : "status"}
      aria-modal={explain || undefined}
      aria-live={explain ? undefined : "polite"}
      aria-labelledby={titleId}
      aria-describedby={def.subtext ? textId : undefined}
      onClick={(event) => {
        // The reveal step: a tap on the card shows the answer too, Skip aside.
        if (def.id !== "reveal") return;
        if (event.target instanceof Element && event.target.closest("button")) return;
        requestReveal();
      }}
      className={cn(
        "w-[calc(100vw-24px)] animate-reveal rounded-xl border border-border bg-popover p-5 text-popover-foreground shadow-overlay motion-reduce:animate-none lg:w-[360px]",
        wide && "lg:w-[420px]",
        def.id === "reveal" && "cursor-pointer",
      )}
    >
      <div className="flex items-center gap-3">
        {def.id === "welcome" && (
          <span
            aria-hidden
            className="grid size-7 place-items-center rounded-md border-[1.5px] border-foreground text-label font-bold"
          >
            M
          </span>
        )}
        <span className="font-mono text-tour-count text-muted-foreground">
          {tour.index + 1} of {tour.total}
        </span>
        <span aria-hidden className="h-1 w-14 overflow-hidden rounded-full bg-secondary">
          <span
            className="block h-full rounded-full bg-foreground"
            style={{ width: `${((tour.index + 1) / tour.total) * 100}%` }}
          />
        </span>
        {!closing && (
          <Button
            variant="ghost"
            className="-my-2 ml-auto h-12 px-3 text-small font-bold"
            onClick={tour.onSkip}
          >
            Skip
          </Button>
        )}
      </div>

      <h2 id={titleId} className="mt-3 text-tour-title text-foreground">
        <Copy text={def.title} touch={tour.touch} />
      </h2>
      {def.subtext && (
        <p id={textId} className="mt-1 text-tour-body text-muted-foreground">
          <Copy text={def.subtext} touch={tour.touch} />
        </p>
      )}

      {explain && (
        <div className="mt-5 flex items-center gap-3">
          {tour.back && !closing && (
            <Button variant="ghost" className="h-12 px-4 text-item font-bold" onClick={tour.onBack}>
              Back
            </Button>
          )}
          <Button
            data-tour-primary
            variant={closing ? "secondary" : "default"}
            className={cn(
              "h-12 gap-2.5 px-6 text-item font-bold",
              // The phone's Next fills the row, in thumb reach; desktop's sits on the right.
              "flex-1 rounded-full lg:ml-auto lg:flex-none",
            )}
            onClick={primary}
          >
            {closing ? "Go to my dashboard" : "Next"}
            {!tour.touch && <Kbd>Enter</Kbd>}
          </Button>
        </div>
      )}
    </div>
  );
}

/** A step's copy, with its keys as chips; on touch, the copy without them. */
function Copy({ text, touch }: { text: string; touch: boolean }) {
  if (touch) return <>{touchCopy(text)}</>;
  const mod = modKey();
  const parts: ReactNode[] = copyParts(text).map((part, i) =>
    "key" in part ? (
      <Kbd key={i} className="mx-0.5 align-[0.1em]">
        {part.key === "Ctrl" ? mod : part.key}
      </Kbd>
    ) : (
      part.text
    ),
  );
  return <>{parts}</>;
}

/**
 * The card's arrow: a 16 px square turned 45°, in the card's fill, with the Rule edge on its
 * two outer sides. Only the half outside the card shows.
 */
export function TourArrow({ base, size, placement }: ArrowRenderProps) {
  const side = placement.split("-")[0] ?? "bottom";
  const vertical = side === "top" || side === "bottom";
  // `placement` is where the card sits from its target. For a card below it ("bottom"), the
  // arrow sits on the card's top edge and points up: the square is centred on the bottom of
  // the arrow's box, where it meets the card, and only its upper half shows.
  return (
    <span
      aria-hidden
      className="relative block overflow-hidden"
      style={vertical ? { width: base, height: size } : { width: size, height: base }}
    >
      <span
        className="absolute size-4 rotate-45 border border-border bg-popover"
        style={{
          [side]: -8,
          ...(vertical ? { left: base / 2 - 8 } : { top: base / 2 - 8 }),
        }}
      />
    </span>
  );
}

function cycleFocus(card: HTMLElement, back: boolean) {
  const buttons = [...card.querySelectorAll<HTMLElement>("button:not([disabled])")];
  if (!buttons.length) return;
  const at = buttons.indexOf(document.activeElement as HTMLElement);
  const next = back ? (at <= 0 ? buttons.length - 1 : at - 1) : (at + 1) % buttons.length;
  buttons[next]?.focus();
}
