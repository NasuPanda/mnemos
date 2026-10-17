import { gapIssue, ok, refuse, type GapIssue, type Ladder, type Result } from "@/core";
import { ApiError, del, patchJson, postJson } from "@/lib/api";
import { count } from "@/lib/format";
import type { LadderErrorResponse, LadderResponse } from "../../worker/contract";
import { refreshDays } from "./day-store";
import { refreshItems } from "./items-store";
import { refreshToday, setLadder } from "./today-store";

/** The message under a gap field: page 20's wording. */
export function gapMessage(issue: GapIssue): string {
  switch (issue.kind) {
    case "gap-out-of-range":
      return `Use a whole number from ${issue.min} to ${issue.max}.`;
    case "gap-not-longer":
      return `Make it longer than stop ${issue.previous.stop} (${count(issue.previous.gap, "day")}).`;
    case "gap-not-shorter":
      return `Make it shorter than stop ${issue.next.stop} (${count(issue.next.gap, "day")}).`;
  }
}

/** A gap field's text as a number of days; anything but digits is not a whole number. */
export function parseGap(text: string): number {
  const trimmed = text.trim();
  return /^\d+$/.test(trimmed) ? Number(trimmed) : Number.NaN;
}

export type GapDraft = {
  gap: number;
  /** What to fix before it can be saved; null when it fits. */
  message: string | null;
  /** Whether saving would change anything. */
  changed: boolean;
};

/** Checks what someone typed into stop `stop`'s field against the saved ladder. */
export function checkGapDraft(ladder: Ladder, stop: number, text: string): GapDraft {
  const gap = parseGap(text);
  const issue = gapIssue(ladder, stop, gap);
  return { gap, message: issue && gapMessage(issue), changed: gap !== ladder[stop - 1] };
}

const OFFLINE = "That didn’t go through. Check your connection and try again.";
const CHANGED = "Your ladder changed in another window. It shows as it is now; try again.";

/** A new gap for one stop, saved. Items keep their due dates; the next ratings use it. */
export async function saveGap(
  ladder: Ladder,
  stop: number,
  gap: number,
): Promise<Result<number[], string>> {
  return change(() =>
    patchJson<LadderResponse>(`/api/ladder/stops/${stop}`, { ladder: [...ladder], gap }),
  );
}

/** A new last stop at double the last gap (at most 365). */
export async function addLadderStop(ladder: Ladder): Promise<Result<number[], string>> {
  return change(() => postJson<LadderResponse>("/api/ladder/stops", { ladder: [...ladder] }));
}

/**
 * Removes a stop: its items move down one stop and the later stops renumber, so today, the
 * Items list and other days are fetched again.
 */
export async function removeLadderStop(
  ladder: Ladder,
  stop: number,
): Promise<Result<number[], string>> {
  const result = await change(() =>
    del<LadderResponse>(`/api/ladder/stops/${stop}?ladder=${ladder.join(",")}`),
  );
  if (result.ok) {
    void refreshToday();
    void refreshItems();
    refreshDays();
  }
  return result;
}

async function change(send: () => Promise<LadderResponse>): Promise<Result<number[], string>> {
  try {
    const { ladder } = await send();
    setLadder(ladder);
    return ok(ladder);
  } catch (error) {
    if (error instanceof ApiError && error.body && typeof error.body === "object") {
      const body = error.body as Partial<LadderErrorResponse>;
      if (Array.isArray(body.ladder)) setLadder(body.ladder);
      if (body.error === "ladder-changed") return refuse(CHANGED);
      if (body.issue) return refuse(gapMessage(body.issue));
    }
    return refuse(OFFLINE);
  }
}
