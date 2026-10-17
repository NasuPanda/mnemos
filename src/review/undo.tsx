import { Check } from "lucide-react";
import { toast } from "sonner";
import { Kbd } from "@/components/ui/kbd";
import { shortDate } from "@/lib/format";
import { undoRating, type LocalRating } from "@/state/today-store";

const UNDO_MS = 4_000;
const LABELS = { confident: "Confident", neutral: "Neutral", not_at_all: "Not at all" } as const;

let last: { rating: LocalRating; until: number; toastId: string | number } | null = null;
const listeners = new Set<(itemId: number) => void>();

/**
 * After a rating: "✓ Confident · Thu 1 Oct · stop 5   Undo U", for 4 s. After the day's last
 * rating it sits at the top right on desktop, clear of All done and its Review early.
 */
export function offerUndo(rating: LocalRating, { endsToday = false } = {}): void {
  if (last) toast.dismiss(last.toastId);
  const { review } = rating;
  const toastId = toast(
    `${LABELS[review.confidence]} · ${shortDate(review.nextDueOn)} · stop ${review.stopAfter}`,
    {
      duration: UNDO_MS,
      position: endsToday ? "top-right" : undefined,
      icon: <Check aria-hidden className="size-4" />,
      action: {
        label: (
          <span className="inline-flex items-center gap-2">
            Undo <Kbd>U</Kbd>
          </span>
        ),
        onClick: () => void undoLast(),
      },
    },
  );
  last = { rating, until: Date.now() + UNDO_MS, toastId };
}

/** U, or the toast's Undo: puts the last rating back while its 4 s last. */
export async function undoLast(): Promise<void> {
  if (!last || Date.now() > last.until) return;
  const { rating, toastId } = last;
  last = null;
  toast.dismiss(toastId);
  if (await undoRating(rating)) listeners.forEach((listener) => listener(rating.itemId));
}

/** Review mode listens, to go back to the undone item. */
export function onUndone(listener: (itemId: number) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
