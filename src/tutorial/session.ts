import { isIsoDate, type IsoDate } from "@/core";
import { emptyForm, type ItemForm } from "@/editor/form";
import { makeSandbox, PRACTICE_ITEM, PRACTICE_LINE, SAMPLE_IMAGES } from "./fixtures";
import { createSandboxApi, type SandboxApi } from "./sandbox-api";
import type { SandboxState } from "./sandbox-state";

// The practice day while it is open: its copy of the API, kept in sessionStorage after every
// change, so a reload or a switch of apps on the phone comes back to the same data (design plan,
// First-run tutorial, "Resume"). A new tab, or a later visit, starts again.

/** Where the open practice day is kept, for this tab only. */
export const SESSION_KEY = "mnemos:tutorial";

/** The part of sessionStorage the practice day uses. */
export type SessionStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

type Saved = { startedOn: IsoDate; state: SandboxState; step?: number };

/** What the practice day tells the tour: the person saved a new item, or rated one. */
export type SessionEvent = "created" | "rated";

export type PracticeSession = {
  api: SandboxApi;
  /** The practice day's today: the date it started. */
  startedOn: IsoDate;
  /** The new item the editor opens with, until the person has saved one of their own. */
  draft(): ItemForm | null;
  /** The tour's step, kept with the practice day so a reload comes back to it. */
  step: number;
  setStep(step: number): void;
  /** Lets go of the practice day and forgets it. */
  close(): void;
};

/** The routes that change the practice day; each saves it once it has. */
const WRITES = [
  "rate",
  "undo",
  "createItem",
  "updateItem",
  "deleteItem",
  "createSection",
  "updateSection",
  "reorderSections",
  "deleteSection",
  "setGap",
  "addStop",
  "removeStop",
] as const;

/**
 * Opens the practice day: the one this tab kept, unless `fresh` or it can't be read (missing,
 * broken, or saved by an older version of the app); otherwise a new one starting `today`.
 */
export function openSession(
  storage: SessionStorage,
  today: IsoDate,
  {
    fresh = false,
    onEvent = () => {},
  }: { fresh?: boolean; onEvent?: (event: SessionEvent) => void } = {},
): PracticeSession {
  const saved = fresh ? null : read(storage);
  const startedOn = saved?.startedOn ?? today;
  const sample = makeSandbox(startedOn);
  const sandbox = createSandboxApi(saved?.state ?? sample, SAMPLE_IMAGES);
  let step = Number.isSafeInteger(saved?.step) && saved!.step! >= 0 ? saved!.step! : 0;
  const save = () => write(storage, { startedOn, state: sandbox.snapshot(), step });

  const api: SandboxApi = { ...sandbox };
  for (const name of WRITES) {
    const route = sandbox[name] as (...args: unknown[]) => Promise<unknown>;
    (api as Record<string, unknown>)[name] = async (...args: unknown[]) => {
      const answer = await route(...args);
      save();
      if (name === "createItem") onEvent("created");
      if (name === "rate") onEvent("rated");
      return answer;
    };
  }
  if (!saved) save();

  return {
    api,
    startedOn,
    get step() {
      return step;
    },
    setStep(next) {
      if (next === step) return;
      step = next;
      save();
    },
    draft() {
      const state = sandbox.snapshot();
      // Item ids only go up, so a higher one means the person saved an item of their own.
      if (state.lastId.item > sample.lastId.item) return null;
      const line = state.sections.find((section) => section.code === PRACTICE_LINE);
      const form = emptyForm(line?.id ?? null);
      return {
        ...form,
        name: PRACTICE_ITEM.name,
        problemText: PRACTICE_ITEM.problemText ?? "",
        answerText: PRACTICE_ITEM.answerText ?? "",
      };
    },
    close() {
      sandbox.dispose();
      storage.removeItem(SESSION_KEY);
    },
  };
}

/** Forgets the kept practice day, so the next one starts fresh. */
export function forgetSession(storage: SessionStorage): void {
  storage.removeItem(SESSION_KEY);
}

function read(storage: SessionStorage): Saved | null {
  try {
    const saved = JSON.parse(storage.getItem(SESSION_KEY) ?? "null") as Partial<Saved> | null;
    if (!saved || !isIsoDate(saved.startedOn) || saved.state?.version !== 1) return null;
    return saved as Saved;
  } catch {
    return null;
  }
}

function write(storage: SessionStorage, saved: Saved): void {
  try {
    storage.setItem(SESSION_KEY, JSON.stringify(saved));
  } catch {
    // Storage full or blocked: the practice day goes on, it just won't survive a reload.
  }
}
