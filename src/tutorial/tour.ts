import { tourSteps, type Layout, type TourScreen, type TourStep } from "./tour-steps";

// The tour's rules, apart from React: which step comes next, and when a step waits (design
// plan, First-run tutorial, "Tour" and "Off the path").

/** Something the person did, or a screen they arrived on. */
export type TourEvent =
  | { type: "next" }
  | { type: "back" }
  | { type: "screen"; screen: TourScreen }
  | { type: "created" }
  | { type: "revealed" }
  | { type: "rated" }
  | { type: "finish" };

/** The index of the step after `event`, on `layout`. Past the last step is `steps.length`. */
export function advance(index: number, event: TourEvent, layout: Layout): number {
  const steps = tourSteps(layout);
  const step = steps[index];
  if (!step) return index;
  if (event.type === "back") return backFrom(steps, index);
  return ends(step, event) ? index + 1 : index;
}

function ends(step: TourStep, event: TourEvent): boolean {
  const { ends } = step;
  switch (event.type) {
    case "next":
      return ends.on === "next";
    case "screen":
      return ends.on === "screen" && ends.screen === event.screen;
    default:
      return ends.on === event.type;
  }
}

/** Back goes to the previous Explain step on the same screen, and nowhere else. */
function backFrom(steps: TourStep[], index: number): number {
  const step = steps[index]!;
  const previous = steps[index - 1];
  if (step.kind !== "explain" || previous?.kind !== "explain") return index;
  return previous.screen === step.screen ? index - 1 : index;
}

/** Whether Back shows on a step: only from the second Explain step on a screen. */
export function hasBack(index: number, layout: Layout): boolean {
  return backFrom(tourSteps(layout), index) !== index;
}

/**
 * Whether the step waits: while the person is off its screen, or while a dialog or sheet is
 * open over it (Pick a date, zoom, the section picker, the command menu …).
 */
export function paused(step: TourStep, screen: TourScreen | null, layerOpen: boolean): boolean {
  return layerOpen || screen !== step.screen;
}

/**
 * The screen the person is on, from the app's path (without /tutorial) and whether the
 * dashboard's run is done; null for screens the tour has no step on (Settings, an item).
 */
export function screenOf(path: string, runDone: boolean): TourScreen | null {
  switch (path) {
    case "/":
      return runDone ? "all-done" : "dashboard";
    case "/items":
      return "items";
    case "/items/new":
      return "editor";
    case "/flash":
      return "flash";
    case "/review":
      return "review";
    default:
      return null;
  }
}
