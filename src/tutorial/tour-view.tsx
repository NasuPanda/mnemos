import "./tour.css";
import { useEffect, useEffectEvent, useMemo, useState, useSyncExternalStore } from "react";
import {
  Joyride,
  type EventData,
  type FloatingOptions,
  type Placement,
  type Step,
} from "react-joyride";
import { DESKTOP, useMediaQuery } from "@/hooks/use-media-query";
import { openAppLayer } from "@/lib/layers";
import { useLocation } from "@/lib/router";
import { useToday } from "@/lib/today";
import { usePanelOpen } from "@/state/overlay";
import { todayView } from "@/state/today-data";
import { useTodayState } from "@/state/today-store";
import {
  leaveTutorial,
  onTourSignal,
  requestReveal,
  setTourStep,
  tourStep,
} from "@/state/tutorial";
import { advance, hasBack, paused, screenOf, type TourEvent } from "./tour";
import { TourArrow, TourCard } from "./tour-card";
import { TourContext } from "./tour-context";
import { tourSteps, type Layout, type TourStep } from "./tour-steps";

/** Where each step's card sits from its target, per layout; "dock" is the bottom of the window. */
const PLACEMENT: Record<Layout, Record<string, Placement | "center" | "dock">> = {
  desktop: {
    welcome: "center",
    lines: "right-start",
    "new-item": "right",
    name: "bottom-start",
    section: "bottom-start",
    // The two side cards are taller than a 900 px window: the card docks under them.
    sides: "dock",
    save: "bottom-end",
    "start-review": "bottom-end",
    "start-run": "top",
    reveal: "bottom",
    rate: "top",
    done: "bottom",
  },
  phone: {
    welcome: "dock",
    lines: "dock",
    "items-tab": "top",
    "new-item": "top",
    name: "dock",
    section: "dock",
    sides: "dock",
    save: "top",
    "review-tab": "top",
    "start-review": "top",
    "start-run": "top",
    reveal: "dock",
    rate: "top",
    done: "bottom",
  },
};

/** The cut-out's corners follow the target's: its radius plus the padding around it. */
const RADIUS: Record<string, number> = {
  lines: 26,
  name: 18,
  section: 18,
  sides: 26,
  "new-item": 22,
  "items-tab": 8,
  "review-tab": 8,
  save: 34,
  "start-review": 34,
  "start-run": 38,
  reveal: 18,
  rate: 8,
  done: 26,
};

/** The steps whose target may be off screen: the side cards further down the editor, All done. */
const SCROLLS = new Set(["sides"]);

/**
 * Docked cards sit at the bottom of the window, 12 px up, or 12 px above `above` when it is on
 * screen (the review's Show answer, on the reveal step): on the phone 12 px in from each edge,
 * in thumb reach; on desktop centred in the content column, right of the 248 px sidebar.
 */
function dock(above?: string): NonNullable<FloatingOptions["middleware"]>[number] {
  return {
    name: "dock",
    fn: ({ rects }) => {
      const sidebar = window.innerWidth >= 1024 ? 248 : 0;
      const column = window.innerWidth - sidebar;
      const floor = above
        ? (document.querySelector(selector(above))?.getBoundingClientRect().top ??
          window.innerHeight)
        : window.innerHeight;
      return {
        x: sidebar ? sidebar + (column - rects.floating.width) / 2 : 12,
        y: Math.min(floor, window.innerHeight) - rects.floating.height - 12,
      };
    },
  };
}

const selector = (name: string) => `[data-tour="${name}"]`;

function joyrideStep(step: TourStep, layout: Layout): Step {
  const place = PLACEMENT[layout][step.id] ?? "bottom";
  const docked = place === "dock";
  const act = step.kind === "act";
  return {
    target: step.target ? selector(step.target) : "body",
    ...(step.spotlight ? { spotlightTarget: selector(step.spotlight) } : {}),
    placement: docked && !step.target ? "center" : docked ? "bottom" : place,
    content: null,
    data: step,
    // Act steps leave the real control live; on Explain steps the target is only shown.
    blockTargetInteraction: !act,
    // Most targets are on screen already; scrolling there would move the banner out of view.
    skipScroll: !SCROLLS.has(step.id),
    spotlightPadding: act ? 10 : 8,
    spotlightRadius: RADIUS[step.id] ?? 18,
    // The reveal step: a tap on the dimmed area shows the answer (see onEvent).
    overlayClickAction: step.id === "reveal" ? "next" : false,
    // The closing card sits under the Végállomás heading; on a short window there is no room
    // below, so it goes beside the heading rather than over the picture.
    ...(step.kind === "closing" && layout === "desktop"
      ? { floatingOptions: { flipOptions: { fallbackPlacements: ["right", "left"] } } }
      : {}),
    ...(docked
      ? {
          floatingOptions: {
            strategy: "fixed",
            hideArrow: true,
            flipOptions: false,
            middleware: [dock(step.id === "reveal" ? "review-controls" : undefined)],
          },
        }
      : {}),
    ...(step.kind === "explain" ? { styles: { spotlight: { className: "tour-edge" } } } : {}),
  };
}

/**
 * The first-run tutorial's tour over the practice day: 12 steps on desktop, 14 on the phone
 * (design plan, First-run tutorial). It moves on from what the person does, waits while they
 * are off a step's screen or a dialog is open, and keeps its step for a reload.
 */
export function Tour() {
  const desktop = useMediaQuery(DESKTOP);
  const touch = useMediaQuery("(hover: none) and (pointer: coarse)");
  const layout: Layout = desktop ? "desktop" : "phone";
  const steps = useMemo(() => tourSteps(layout), [layout]);
  const [position, setPosition] = useState(() => ({ layout, index: tourStep() }));
  const index = position.layout === layout ? position.index : remap(position, layout);
  const step = steps[index];

  const dispatch = (event: TourEvent) =>
    setPosition((at) => {
      const from = at.layout === layout ? at.index : remap(at, layout);
      return { layout, index: advance(from, event, layout) };
    });
  const onSignal = useEffectEvent(dispatch);
  useEffect(() => onTourSignal((event) => onSignal(event)), []);
  useEffect(() => setTourStep(index), [index]);

  // Arriving on a screen can end an Act step (the editor opens, the run starts …).
  const { path } = useLocation();
  const runDone = useRunDone();
  const screen = screenOf(path, runDone);
  const [seen, setSeen] = useState(screen);
  if (screen !== seen) {
    setSeen(screen);
    if (screen) dispatch({ type: "screen", screen });
  }

  const layerOpen = useAppLayerOpen();
  const run = !!step && !paused(step, screen, layerOpen);
  useActRing(run && step.kind === "act" && step.ring !== false ? step.target : null);
  useEffect(() => {
    if (!run || step.kind !== "closing") return;
    document.documentElement.dataset.tourKind = "closing";
    return () => void delete document.documentElement.dataset.tourKind;
  }, [run, step?.kind]);

  const joySteps = useMemo(() => steps.map((s) => joyrideStep(s, layout)), [steps, layout]);
  if (!step) return null;

  const onEvent = (data: EventData) => {
    if (data.action === "next" && data.origin === "overlay" && step.id === "reveal") {
      requestReveal();
    }
  };

  return (
    <TourContext
      value={{
        index,
        total: steps.length,
        back: hasBack(index, layout),
        touch,
        onNext: () => dispatch({ type: "next" }),
        onBack: () => dispatch({ type: "back" }),
        onSkip: () => leaveTutorial("skip"),
        onFinish: () => leaveTutorial("finish"),
      }}
    >
      <Joyride
        run={run}
        stepIndex={index}
        steps={joySteps}
        continuous
        tooltipComponent={TourCard}
        arrowComponent={TourArrow}
        loaderComponent={null}
        onEvent={onEvent}
        options={{
          skipBeacon: true,
          disableFocusTrap: true,
          dismissKeyAction: false,
          overlayClickAction: false,
          offset: 14,
          arrowBase: 24,
          arrowSize: 12,
          scrollOffset: 96,
          targetWaitTimeout: 5000,
          // Above the app's sticky headers and tab bar (z 20–30), below its dialogs (z 50).
          zIndex: 40,
        }}
        styles={{ floater: { filter: "none" } }}
      />
    </TourContext>
  );
}

/** The same step in the other layout's list, when the window crosses 1024 px. */
function remap(at: { layout: Layout; index: number }, layout: Layout): number {
  const id = tourSteps(at.layout)[at.index]?.id;
  const found = tourSteps(layout).findIndex((s) => s.id === id);
  return found >= 0 ? found : Math.min(at.index, tourSteps(layout).length - 1);
}

/** Whether the practice dashboard shows All done: today's run has nothing left. */
function useRunDone(): boolean {
  const { path, query } = useLocation();
  const today = useToday();
  const state = useTodayState(today);
  if (path !== "/" || (query.get("day") ?? today) !== today) return false;
  return state.status === "ready" && todayView(state.data).counts.left === 0;
}

/** Whether a dialog, sheet, menu or panel of the app's is open over the screen. */
function useAppLayerOpen(): boolean {
  const layer = useSyncExternalStore(
    (onChange) => {
      const observer = new MutationObserver(onChange);
      observer.observe(document.body, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["data-state"],
      });
      return () => observer.disconnect();
    },
    openAppLayer,
    () => false,
  );
  return usePanelOpen() || layer;
}

/** Rings an Act step's real control in tram yellow while the step shows. */
function useActRing(target: string | null) {
  const { path } = useLocation();
  useEffect(() => {
    if (!target) return;
    let ringed: Element | null = null;
    const ring = () => {
      const element = document.querySelector(selector(target));
      if (element === ringed) return;
      ringed?.removeAttribute("data-tour-ring");
      ringed = element;
      ringed?.setAttribute("data-tour-ring", "");
    };
    ring();
    // The control may render a moment later, or be replaced.
    const observer = new MutationObserver(ring);
    observer.observe(document.body, { subtree: true, childList: true });
    return () => {
      observer.disconnect();
      ringed?.removeAttribute("data-tour-ring");
    };
  }, [target, path]);
}
