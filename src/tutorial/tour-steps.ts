// The first-run tutorial's tour, step by step: the design plan's table (First-run tutorial,
// "Tour"), 12 steps on desktop and 14 on the phone, whose dashboard has no New item.

/** Below 1024 px the steps point at the tab bar, from 1024 px at the sidebar. */
export type Layout = "phone" | "desktop";

/** Where a step happens; the tour pauses while the person is anywhere else. */
export type TourScreen = "dashboard" | "items" | "editor" | "flash" | "review" | "all-done";

/**
 * What the person does that ends a step: Next on an Explain card, arriving on a screen, saving
 * the practice item, seeing the answer, rating, or Go to my dashboard on the closing card.
 */
export type StepEnd =
  | { on: "next" }
  | { on: "screen"; screen: TourScreen }
  | { on: "created" }
  | { on: "revealed" }
  | { on: "rated" }
  | { on: "finish" };

export type TourStep = {
  id: string;
  /** Explain: a card with Next holds the focus. Act: the real control does it. */
  kind: "explain" | "act" | "closing";
  screen: TourScreen;
  /** The `data-tour` value of what the step points at; null for none. */
  target: string | null;
  /** What stays lit, when it isn't the target itself. */
  spotlight?: string;
  /** Act steps ring their target in tram yellow, but for the reveal: it has no control. */
  ring?: false;
  /**
   * The title, then the subtext. A key in [brackets] is a key chip, shown with a mouse or
   * trackpad and left out on touch: "[Ctrl Enter]" is two chips.
   */
  title: string;
  subtext?: string;
  ends: StepEnd;
};

const YOUR_TURN = "Your turn!";

const welcome: TourStep = {
  id: "welcome",
  kind: "explain",
  screen: "dashboard",
  target: null,
  title: "Welcome to Mnemos",
  ends: { on: "next" },
};

const lines: TourStep = {
  id: "lines",
  kind: "explain",
  screen: "dashboard",
  target: "line-hu",
  title: "Lines and stations",
  subtext:
    "Each line groups things to remember. Every item is a station; the squares show its progress!",
  ends: { on: "next" },
};

const name: TourStep = {
  id: "name",
  kind: "explain",
  screen: "editor",
  target: "editor-name",
  title: "Name the review item!",
  ends: { on: "next" },
};

const section: TourStep = {
  id: "section",
  kind: "explain",
  screen: "editor",
  target: "editor-section",
  title: "Pick a line, or type a new name to create one!",
  ends: { on: "next" },
};

const sides: TourStep = {
  id: "sides",
  kind: "explain",
  screen: "editor",
  target: "editor-sides",
  title: "Input the problem and its answer!",
  subtext: "You can use images here.",
  ends: { on: "next" },
};

const startRun: TourStep = {
  id: "start-run",
  kind: "act",
  screen: "flash",
  target: "flash-start",
  title: "4 items on 2 lines, 1 of them late. Start when you’re ready [Enter]",
  subtext: YOUR_TURN,
  ends: { on: "screen", screen: "review" },
};

const rate: TourStep = {
  id: "rate",
  kind: "act",
  screen: "review",
  target: "rating-dock",
  spotlight: "rating-area",
  title: "Pick how confident you feel!",
  subtext: "Your confidence rating moves this item on the ladder and sets its next review date!",
  ends: { on: "rated" },
};

/** The steps for `layout`, in order. */
export function tourSteps(layout: Layout): TourStep[] {
  if (layout === "desktop") {
    return [
      welcome,
      lines,
      {
        id: "new-item",
        kind: "act",
        screen: "dashboard",
        target: "sidebar-new-item",
        title: "Add something to remember [N]",
        subtext: YOUR_TURN,
        ends: { on: "screen", screen: "editor" },
      },
      name,
      section,
      sides,
      {
        id: "save",
        kind: "act",
        screen: "editor",
        target: "editor-save-top",
        title: "Save it [Ctrl Enter]",
        subtext: YOUR_TURN,
        ends: { on: "created" },
      },
      {
        id: "start-review",
        kind: "act",
        screen: "dashboard",
        target: "start-review-top",
        title: "Review everything due today in one run [F]",
        subtext: YOUR_TURN,
        ends: { on: "screen", screen: "flash" },
      },
      startRun,
      {
        id: "reveal",
        kind: "act",
        screen: "review",
        target: "review-problem",
        ring: false,
        title: "Think of the answer, then click anywhere or press [Space] to see it.",
        subtext: YOUR_TURN,
        ends: { on: "revealed" },
      },
      rate,
      {
        id: "done",
        kind: "closing",
        screen: "all-done",
        target: "all-done-heading",
        spotlight: "all-done",
        title: "Well done",
        subtext:
          "That’s the whole loop. Change the ladder in Settings (Menetrend, “Timetable”). Replay this tutorial from [?] or the command menu [Ctrl K]",
        ends: { on: "finish" },
      },
    ];
  }
  return [
    welcome,
    lines,
    {
      id: "items-tab",
      kind: "act",
      screen: "dashboard",
      target: "tab-items",
      title: "Add something to remember [N]",
      subtext: YOUR_TURN,
      ends: { on: "screen", screen: "items" },
    },
    {
      id: "new-item",
      kind: "act",
      screen: "items",
      target: "items-new-item",
      title: "Add something to remember.",
      subtext: YOUR_TURN,
      ends: { on: "screen", screen: "editor" },
    },
    name,
    section,
    sides,
    {
      id: "save",
      kind: "act",
      screen: "editor",
      target: "editor-save-bottom",
      title: "Save it [Ctrl Enter]",
      subtext: YOUR_TURN,
      ends: { on: "created" },
    },
    {
      id: "review-tab",
      kind: "act",
      screen: "items",
      target: "tab-review",
      title: "Now review today’s items.",
      subtext: YOUR_TURN,
      ends: { on: "screen", screen: "dashboard" },
    },
    {
      id: "start-review",
      kind: "act",
      screen: "dashboard",
      target: "start-review-floating",
      title: "Review everything due today in one run [F]",
      subtext: YOUR_TURN,
      ends: { on: "screen", screen: "flash" },
    },
    startRun,
    {
      id: "reveal",
      kind: "act",
      screen: "review",
      target: "review-problem",
      ring: false,
      title: "Think of the answer, then tap anywhere to see it.",
      subtext: YOUR_TURN,
      ends: { on: "revealed" },
    },
    rate,
    {
      id: "done",
      kind: "closing",
      screen: "all-done",
      target: "all-done-heading",
      spotlight: "all-done",
      title: "Well done",
      subtext:
        "That’s the whole loop. Change the ladder in Settings (Menetrend, “Timetable”); you can replay this tutorial there too.",
      ends: { on: "finish" },
    },
  ];
}

/** A piece of a step's copy: text, or a key chip. */
export type CopyPart = { text: string } | { key: string };

/** Splits a step's copy into text and key chips: "Save it [Ctrl Enter]" → text, Ctrl, Enter. */
export function copyParts(copy: string): CopyPart[] {
  const parts: CopyPart[] = [];
  for (const piece of copy.split(/(\[[^\]]+\])/)) {
    if (!piece) continue;
    if (piece.startsWith("[")) {
      for (const key of piece.slice(1, -1).split(" ")) parts.push({ key });
    } else parts.push({ text: piece });
  }
  return parts;
}

/**
 * The copy on a touch screen, which has no keys: chips that end a sentence are left out, and a
 * key in the middle of one stays as a word.
 */
export function touchCopy(copy: string): string {
  return copy
    .replace(/\s*\[[^\]]+\](?=[.!?]?$|[.!?]\s)/g, "")
    .replace(/\[([^\]]+)\]/g, "$1")
    .trim();
}
