import { ArrowRight, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { gapFor, lastStop, removalEffect, type Ladder } from "@/core";
import { Confirm } from "@/components/confirm";
import { count } from "@/lib/format";
import { removeLadderStop } from "@/state/ladder";

/**
 * "Remove stop 3?" (page 32): where its items go and what renumbers, before anything happens.
 * Cancel has the focus, so a plain Enter never removes a stop.
 */
export function RemoveStop({
  ladder,
  stop,
  items,
  onClose,
  onRemoved,
}: {
  ladder: Ladder;
  stop: number | null;
  /** How many items are on the stop now. */
  items: number;
  onClose: () => void;
  onRemoved: (stop: number) => void;
}) {
  const [busy, setBusy] = useState(false);
  const effect = stop === null ? null : removalEffect(ladder, stop);
  const shown = stop !== null && effect?.ok ? { stop, ...effect.value } : null;

  const remove = async () => {
    if (!shown || busy) return;
    setBusy(true);
    const result = await removeLadderStop(ladder, shown.stop);
    setBusy(false);
    if (!result.ok) return void toast(result.error);
    onRemoved(shown.stop);
  };

  return (
    <Confirm
      open={shown !== null}
      onOpenChange={(open) => !open && onClose()}
      title={shown ? `Remove stop ${shown.stop}?` : "Remove stop?"}
      confirmLabel={shown ? `Remove stop ${shown.stop}` : "Remove stop"}
      confirmIcon={<Trash2 aria-hidden className="size-5" />}
      busy={busy}
      onConfirm={() => void remove()}
      description={shown && <Explanation ladder={ladder} items={items} {...shown} />}
    />
  );
}

function Explanation({
  ladder,
  stop,
  items,
  movesTo,
  movesToGap,
  laterStopsRenumber,
}: {
  ladder: Ladder;
  stop: number;
  items: number;
  movesTo: number;
  movesToGap: number;
  laterStopsRenumber: boolean;
}) {
  const gap = count(movesToGap, "day");
  const one = items === 1;
  const where =
    stop === 1
      ? `${one ? "stays" : "stay"} on the new stop 1 (${gap})`
      : `${one ? "moves" : "move"} down to stop ${movesTo} (${gap})`;
  return (
    <>
      <span className="flex items-center gap-4 rounded-lg bg-muted p-4 text-body text-foreground">
        <span aria-hidden className="flex shrink-0 items-center gap-3">
          <Square n={stop} />
          <ArrowRight className="size-4 text-muted-foreground" />
          <Square n={movesTo} />
        </span>
        <span>
          {items === 0 ? (
            <>No items are on stop {stop}.</>
          ) : (
            <>
              <strong className="font-bold">{count(items, "item")}</strong> {where}.
            </>
          )}
        </span>
      </span>
      <span className="mt-4 block">
        {items > 0 && "Their due dates stay as they are. "}
        {laterStopsRenumber
          ? `The stops after it move up one number: stop ${stop + 1} becomes stop ${stop}.`
          : `Stop ${lastStop(ladder) - 1} becomes the Végállomás, the end of the line (${count(gapFor(ladder, lastStop(ladder) - 1), "day")}).`}
      </span>
    </>
  );
}

function Square({ n }: { n: number }) {
  return (
    <span className="grid size-8 place-items-center rounded-md border-2 border-foreground font-mono text-meta font-bold text-foreground">
      {n}
    </span>
  );
}
