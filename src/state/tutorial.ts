import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import type { ItemForm } from "@/editor/form";
import { DESKTOP } from "@/hooks/use-media-query";
import { api, httpApi } from "@/lib/api";
import { currentBase, navigate, navigateAsking, stripBase, type Base } from "@/lib/router";
import { PRACTICE_BASE } from "@/lib/routes";
import { localToday, pinToday } from "@/lib/today";
import type { PracticeSession } from "@/tutorial/session";
import { switchApi } from "./source";

// The first-run tutorial's way in and out (design plan, First-run tutorial): the gate that sends
// a new account to the practice day, opening and closing it as the address enters and leaves
// /tutorial, Skip, finishing, and Replay. The practice day itself (its data, its banner) loads
// with import() only when the address is under /tutorial.

/**
 * Which API the screens may use now. "opening": the address is under /tutorial and the practice
 * day is loading, so nothing renders yet, and no screen asks the Worker for its data.
 */
export type TutorialMode = "app" | "opening" | "practice";

let mode: TutorialMode = "app";
let session: PracticeSession | null = null;
/** The person's flag from GET /api/me; undefined until it has answered. */
let completedAt: string | null | undefined;
/** This page left its practice day: Back into one of its addresses goes to the app instead. */
let ended = false;
/** The next practice day starts fresh, not from what this tab kept (Replay). */
let fresh = false;
let gateStarted = false;

const listeners = new Set<() => void>();
function setMode(next: TutorialMode) {
  mode = next;
  listeners.forEach((listener) => listener());
}

export function useTutorialMode(): TutorialMode {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => mode,
    () => "app",
  );
}

/** Whether `mode` matches the address's `base`, so the screens can render. */
export const tutorialReady = (base: Base, current: TutorialMode) =>
  base === PRACTICE_BASE ? current === "practice" : current === "app";

/**
 * The gate: asks GET /api/me alongside the first screen's own data, and sends a person who
 * hasn't finished or skipped the tutorial to the practice day. Runs once per page load.
 */
export function startGate(): void {
  if (gateStarted) return;
  gateStarted = true;
  api()
    .me()
    .then((me) => {
      if (completedAt === undefined) completedAt = me.tutorialCompletedAt;
      if (completedAt === null && !ended && currentBase() === "") {
        navigate("/", { base: PRACTICE_BASE, replace: true });
      }
    })
    .catch(() => {});
}

/**
 * Opens or closes the practice day to match the address: under /tutorial, the practice copy of
 * the API; anywhere else, the Worker's. Called whenever the base or the mode changes.
 */
export function syncTutorial(base: Base): void {
  if (base === "") {
    if (mode !== "app") closePractice();
    return;
  }
  if (mode !== "app") return;
  if (ended) {
    // Back into a practice day this page already left: the same place in the app instead.
    navigate(`${stripBase(window.location.pathname, base)}${window.location.search}`, {
      base: "",
      replace: true,
    });
    return;
  }
  void openPractice();
}

async function openPractice() {
  setMode("opening");
  try {
    // The banner's code comes along, so the first practice screen shows with it.
    const [{ openSession }] = await Promise.all([
      import("@/tutorial/session"),
      import("@/tutorial/practice-layer"),
    ]);
    if (mode !== "opening" || currentBase() !== PRACTICE_BASE) return;
    session = openSession(window.sessionStorage, localToday(), { fresh });
    fresh = false;
    pinToday(session.startedOn);
    switchApi(session.api);
    setMode("practice");
  } catch {
    // The practice day couldn't load (offline, say): the person's own board instead.
    setMode("app");
    ended = true;
    navigate("/", { base: "", replace: true });
  }
}

function closePractice() {
  session?.close();
  session = null;
  pinToday(null);
  switchApi(httpApi);
  setMode("app");
}

/**
 * Leaves the practice day for the person's own dashboard, without asking about unsaved changes:
 * nothing in it is real. On the first run it sets the flag; a failed call still leaves, and the
 * tutorial comes back on the next visit. Skip says how to replay it.
 */
export function leaveTutorial(how: "skip" | "finish"): void {
  markCompleted();
  ended = true;
  navigate("/", { base: "", replace: true });
  if (how === "skip") {
    const where = window.matchMedia(DESKTOP).matches ? "? or the command menu" : "Settings";
    toast(`Tutorial skipped. Replay it from ${where}.`, { duration: 4000 });
  }
}

function markCompleted() {
  const complete = (completeTutorial: () => Promise<void>) => {
    completedAt = new Date().toISOString();
    completeTutorial().catch(() => {});
  };
  // Replay never sets the flag: only a person who hasn't finished or skipped it yet does.
  if (completedAt === null) complete(api().completeTutorial);
  else if (completedAt === undefined) {
    const { me, completeTutorial } = api();
    me()
      .then((answer) => {
        completedAt ??= answer.tutorialCompletedAt;
        if (completedAt === null) complete(completeTutorial);
      })
      .catch(() => {});
  }
}

/** Starts a fresh practice day at the beginning, from anywhere; the flag stays as it is. */
export function replayTutorial(): void {
  fresh = true;
  ended = false;
  if (mode === "app") {
    navigateAsking("/", { base: PRACTICE_BASE });
    return;
  }
  // Already in the practice day: start it over, on its dashboard.
  navigate("/", { base: PRACTICE_BASE });
  closePractice();
}

/** The new item the practice editor opens with, or null outside the practice day. */
export function practiceDraft(): ItemForm | null {
  return mode === "practice" ? (session?.draft() ?? null) : null;
}
