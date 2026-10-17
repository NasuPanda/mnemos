import { ArrowUp, Equal, Info, Plus, RotateCcw, Trash2, TriangleAlert } from "lucide-react";
import { useId, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { toast } from "sonner";
import { addStopRefusal, lastStop, type IsoDate, type Ladder } from "@/core";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { DESKTOP, useMediaQuery } from "@/hooks/use-media-query";
import { count } from "@/lib/format";
import { cn } from "@/lib/utils";
import { addLadderStop, checkGapDraft, saveGap } from "@/state/ladder";
import { LadderPreview } from "./ladder-preview";
import { RemoveStop } from "./remove-stop";

const REFUSALS = {
  "max-stops": "A ladder has at most 7 stops.",
  "last-gap-at-max": "The last stop is already 365 days, the longest gap.",
} as const;

/**
 * The ladder editor: each stop's gap and item count, add and remove stops, and where each rating
 * leads from the selected stop. Desktop draws the ladder across (page 30), the phone down
 * (page 31). Keys: ← → between stops, Enter edits the gap, Del removes the stop, A adds one.
 */
export function LadderEditor({
  ladder,
  counts,
  today,
  account,
}: {
  ladder: Ladder;
  /** Items per stop; undefined until the Items list has loaded. */
  counts: Map<number, number> | undefined;
  today: IsoDate;
  /** The Account card, beside the preview on desktop. */
  account: React.ReactNode;
}) {
  const desktop = useMediaQuery(DESKTOP);
  const [selected, setSelected] = useState(1);
  const [removing, setRemoving] = useState<number | null>(null);
  const [suggested, setSuggested] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const squares = useRef(new Map<number, HTMLButtonElement>());
  const fields = useRef(new Map<number, HTMLInputElement>());
  const refusal = addStopRefusal(ladder);
  const stops = ladder.length;
  const current = Math.min(selected, stops);
  const total = counts ? [...counts.values()].reduce((sum, n) => sum + n, 0) : null;

  const add = async () => {
    if (refusal || adding) return;
    setAdding(true);
    const result = await addLadderStop(ladder);
    setAdding(false);
    if (!result.ok) return void toast(result.error);
    const added = result.value.length;
    setSelected(added);
    setSuggested(added);
    requestAnimationFrame(() => fields.current.get(added)?.focus());
  };
  useHotkeys({ a: () => void add() }, removing === null);

  /** ← → (and ↑ ↓ on the phone's column) between stops, Enter to the gap, Del to remove. */
  const onSquareKey = (stop: number) => (event: KeyboardEvent<HTMLButtonElement>) => {
    const step = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[event.key];
    if (step) {
      event.preventDefault();
      const next = Math.min(Math.max(stop + step, 1), stops);
      setSelected(next);
      squares.current.get(next)?.focus();
    } else if (event.key === "Enter") {
      event.preventDefault();
      fields.current.get(stop)?.focus();
    } else if ((event.key === "Delete" || event.key === "Backspace") && stops > 1) {
      event.preventDefault();
      setRemoving(stop);
    }
  };

  const shared = {
    ladder,
    counts,
    selected: current,
    suggested,
    onSelect: setSelected,
    onSuggestedDone: () => setSuggested(null),
    onRemove: setRemoving,
    onSquareKey,
    squares,
    fields,
  };

  const addButton = (
    <Button
      variant="secondary"
      className="h-12 gap-2 px-4 text-item font-bold"
      disabled={!!refusal || adding}
      onClick={() => void add()}
    >
      <Plus aria-hidden className="size-5" />
      Add stop
      <Kbd>A</Kbd>
    </Button>
  );

  return (
    <>
      {/* A card on desktop; on the phone the ladder sits on the page, as on page 31. */}
      <section
        aria-labelledby="ladder-title"
        className="mt-6 lg:mt-8 lg:rounded-xl lg:bg-card lg:p-8 lg:shadow-card"
      >
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-baseline gap-3">
            <h2 id="ladder-title" className="sr-only lg:not-sr-only lg:text-heading">
              Ladder
            </h2>
            <p className="hidden font-mono text-meta text-muted-foreground lg:block">
              {stops} of 7 stops{total !== null && ` · ${count(total, "item")}`}
            </p>
          </div>
          {desktop && (
            <div className="flex items-center gap-4">
              {refusal && <p className="text-small text-muted-foreground">{REFUSALS[refusal]}</p>}
              {addButton}
            </div>
          )}
        </header>

        <Rules compact={!desktop} />

        {desktop ? <AcrossLadder {...shared} /> : <DownLadder {...shared} />}

        {!desktop && (
          <div className="mt-4 flex flex-wrap items-center gap-4">
            {addButton}
            {refusal && <p className="text-small text-muted-foreground">{REFUSALS[refusal]}</p>}
          </div>
        )}

        {desktop && (
          <footer className="mt-8 flex items-start justify-between gap-6 border-t border-border pt-5 text-small text-muted-foreground">
            <p className="flex max-w-[44rem] gap-3">
              <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
              Edits apply from each item’s next review; due dates already set stay as they are.
              Removing a stop moves its items down one stop.
            </p>
            <p className="flex shrink-0 items-center gap-2 whitespace-nowrap">
              <KbdGroup>
                <Kbd>←</Kbd>
                <Kbd>→</Kbd>
              </KbdGroup>
              stop
              <Kbd className="ml-3">Enter</Kbd>
              edit gap
              <Kbd className="ml-3">Del</Kbd>
              remove
            </p>
          </footer>
        )}
      </section>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
        <LadderPreview ladder={ladder} stop={current} today={today} />
        {account}
      </div>

      <RemoveStop
        ladder={ladder}
        stop={removing}
        items={removing === null ? 0 : (counts?.get(removing) ?? 0)}
        onClose={() => setRemoving(null)}
        onRemoved={(stop) => {
          setRemoving(null);
          setSelected(Math.max(1, Math.min(stop, stops - 1)));
        }}
      />
    </>
  );
}

type LadderProps = {
  ladder: Ladder;
  counts: Map<number, number> | undefined;
  selected: number;
  suggested: number | null;
  onSelect: (stop: number) => void;
  onSuggestedDone: () => void;
  onRemove: (stop: number) => void;
  onSquareKey: (stop: number) => (event: KeyboardEvent<HTMLButtonElement>) => void;
  squares: RefObject<Map<number, HTMLButtonElement>>;
  fields: RefObject<Map<number, HTMLInputElement>>;
};

/** Items on a stop, 0 for none; undefined until the Items list has loaded. */
const itemsOn = (counts: Map<number, number> | undefined, stop: number) =>
  counts ? (counts.get(stop) ?? 0) : undefined;

/** "↑ Confident up one stop · = Neutral stays on its stop · ↺ Not at all back to stop 1". */
function Rules({ compact }: { compact: boolean }) {
  const rules = [
    { icon: ArrowUp, name: "Confident", rest: compact ? "up one" : "up one stop" },
    { icon: Equal, name: "Neutral", rest: compact ? "stays" : "stays on its stop" },
    { icon: RotateCcw, name: "Not at all", rest: compact ? "to stop 1" : "back to stop 1" },
  ];
  return (
    <ul
      aria-label="How ratings move an item"
      className={cn("mt-4 flex flex-wrap", compact ? "gap-x-5 gap-y-2" : "gap-2")}
    >
      {rules.map(({ icon: Icon, name, rest }) => (
        <li
          key={name}
          className={cn(
            "inline-flex items-center gap-2 text-small",
            !compact && "h-9 rounded-full bg-muted px-4",
          )}
        >
          <Icon aria-hidden className="size-4" />
          <span>
            <strong className="font-bold">{name}</strong> {rest}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Desktop (page 30): the gaps in a row, then the rails with the stops, counts and trash. */
function AcrossLadder(props: LadderProps) {
  const { ladder, counts, selected, onRemove, squares } = props;
  const columns = { gridTemplateColumns: `repeat(${ladder.length}, minmax(0, 1fr))` };
  return (
    <div className="mt-6">
      <div className="grid gap-4" style={columns}>
        {ladder.map((_, index) => (
          <GapField key={index} {...props} stop={index + 1} labelled />
        ))}
      </div>

      <div className="relative mt-6">
        <span className="absolute -top-5 left-0 text-small text-muted-foreground">New</span>
        {/* Two rails, from New to the last stop. */}
        <Rails
          className="absolute top-[18px] left-0"
          style={{ width: `calc(${100 - 100 / ladder.length / 2}% )` }}
        />
        <ol className="relative grid gap-4" style={columns}>
          {ladder.map((_, index) => {
            const stop = index + 1;
            const last = stop === lastStop(ladder);
            return (
              <li key={stop} className="flex flex-col items-start gap-3">
                <span className="flex w-full justify-center">
                  <StopSquare
                    stop={stop}
                    last={last}
                    selected={stop === selected}
                    items={itemsOn(counts, stop)}
                    gap={ladder[index] as number}
                    onKey={props.onSquareKey(stop)}
                    onFocus={() => props.onSelect(stop)}
                    squares={squares}
                  />
                </span>
                <StopLabel
                  stop={stop}
                  last={last}
                  items={itemsOn(counts, stop)}
                  className="px-1.5"
                />
                {ladder.length > 1 && <TrashButton stop={stop} onRemove={onRemove} />}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

/** Phone (page 31): the ladder runs down; each stop has its count, gap and trash in a row. */
function DownLadder(props: LadderProps) {
  const { ladder, counts, selected, onRemove, squares } = props;
  return (
    <ol className="relative mt-5">
      {ladder.map((_, index) => {
        const stop = index + 1;
        const last = stop === lastStop(ladder);
        return (
          <li key={stop} className="relative flex flex-wrap items-center gap-x-3 gap-y-2 py-2">
            {!last && <Rails vertical className="absolute top-1/2 left-[18px] h-full" />}
            <StopSquare
              stop={stop}
              last={last}
              selected={stop === selected}
              items={itemsOn(counts, stop)}
              gap={ladder[index] as number}
              onKey={props.onSquareKey(stop)}
              onFocus={() => props.onSelect(stop)}
              squares={squares}
            />
            <StopLabel
              stop={stop}
              last={last}
              items={itemsOn(counts, stop)}
              className="min-w-0 flex-1"
            />
            <GapField {...props} stop={stop} />
            {ladder.length > 1 ? (
              <TrashButton stop={stop} onRemove={onRemove} />
            ) : (
              <span className="size-12 shrink-0" />
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** Two Mist rails: the ladder is drawn in neutrals only. */
function Rails({
  vertical = false,
  className,
  style,
}: {
  vertical?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      aria-hidden
      style={style}
      className={cn(
        "flex justify-between",
        vertical ? "w-[7px] flex-row" : "h-[7px] flex-col",
        className,
      )}
    >
      <span className={cn("bg-rail", vertical ? "h-full w-0.5" : "h-0.5 w-full")} />
      <span className={cn("bg-rail", vertical ? "h-full w-0.5" : "h-0.5 w-full")} />
    </span>
  );
}

/** A stop's square: Foam on the rails; the last stop doubled; yellow only when focused. */
function StopSquare({
  stop,
  last,
  selected,
  items,
  gap,
  onKey,
  onFocus,
  squares,
}: {
  stop: number;
  last: boolean;
  selected: boolean;
  items: number | undefined;
  gap: number;
  onKey: (event: KeyboardEvent<HTMLButtonElement>) => void;
  onFocus: () => void;
  squares: RefObject<Map<number, HTMLButtonElement>>;
}) {
  return (
    <button
      type="button"
      ref={(el) => {
        if (el) squares.current.set(stop, el);
        else squares.current.delete(stop);
      }}
      tabIndex={selected ? 0 : -1}
      aria-label={`${last ? "Végállomás, stop" : "Stop"} ${stop}: ${count(gap, "day")}${items === undefined ? "" : `, ${count(items, "item")}`}`}
      aria-keyshortcuts="ArrowLeft ArrowRight Enter Delete"
      onKeyDown={onKey}
      onFocus={onFocus}
      className={cn(
        "relative z-10 grid size-10 shrink-0 place-items-center rounded-md border-2 border-foreground bg-card font-mono text-meta font-bold",
        last &&
          "outline-2 outline-offset-2 outline-foreground outline-solid focus-visible:outline-ring",
      )}
    >
      {stop}
    </button>
  );
}

/** "58 items" under a stop; the last one is the Végállomás, the end of the line. */
function StopLabel({
  stop,
  last,
  items,
  className,
}: {
  stop: number;
  last: boolean;
  items: number | undefined;
  className?: string;
}) {
  const itemCount = items !== undefined && (
    <span className="font-mono text-meta text-muted-foreground">{count(items, "item")}</span>
  );
  return (
    <span className={cn("flex flex-col gap-0.5", className)}>
      {last ? (
        <>
          <span lang="hu" className="text-section">
            Végállomás
          </span>
          <span className="text-small text-muted-foreground">End of the line</span>
        </>
      ) : (
        <span className="text-section lg:hidden">Stop {stop}</span>
      )}
      {itemCount}
    </span>
  );
}

function TrashButton({ stop, onRemove }: { stop: number; onRemove: (stop: number) => void }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-12 shrink-0 text-muted-foreground lg:size-10"
      aria-label={`Remove stop ${stop}…`}
      onClick={() => onRemove(stop)}
    >
      <Trash2 aria-hidden className="size-5" />
    </Button>
  );
}

/**
 * A stop's gap in days. Saved on Enter or when the field is left, if it fits between its
 * neighbours; otherwise the message says what to change and nothing is saved. Esc puts the saved
 * gap back.
 */
function GapField({
  ladder,
  stop,
  labelled = false,
  suggested,
  onSelect,
  onSuggestedDone,
  fields,
}: LadderProps & { stop: number; labelled?: boolean }) {
  const gap = ladder[stop - 1] as number;
  // What is being typed; null while the field shows the saved gap.
  const [typed, setTyped] = useState<string | null>(null);
  const text = typed ?? String(gap);
  const [saving, setSaving] = useState(false);
  const id = useId();
  const messageId = useId();
  const draft = checkGapDraft(ladder, stop, text);
  const message = text !== String(gap) ? draft.message : null;
  const hint = suggested === stop && !message;

  const commit = async () => {
    if (draft.message || !draft.changed || saving) return;
    setSaving(true);
    const result = await saveGap(ladder, stop, draft.gap);
    setSaving(false);
    if (!result.ok) toast(result.error);
  };

  return (
    // Desktop: a column under "Stop 4". Phone: the field sits in the stop's row and its message
    // wraps onto a line of its own below.
    <div className={labelled ? "flex flex-col gap-2" : "contents"}>
      {labelled && (
        <label htmlFor={id} className="text-label">
          Stop {stop}
        </label>
      )}
      <InputGroup className={cn("h-12", !labelled && "w-28 shrink-0")}>
        <InputGroupInput
          id={id}
          ref={(el) => {
            if (el) fields.current.set(stop, el);
            else fields.current.delete(stop);
          }}
          inputMode="numeric"
          enterKeyHint="done"
          autoComplete="off"
          aria-label={labelled ? undefined : `Stop ${stop} gap, in days`}
          aria-invalid={message ? true : undefined}
          aria-describedby={message || hint ? messageId : undefined}
          value={text}
          onChange={(event) => setTyped(event.target.value)}
          onFocus={() => onSelect(stop)}
          onBlur={() => {
            onSuggestedDone();
            void commit();
            setTyped(null);
          }}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === "Enter") {
              event.preventDefault();
              void commit();
            } else if (event.key === "Escape") {
              event.preventDefault();
              setTyped(null);
              event.currentTarget.blur();
            }
          }}
          className="w-16 flex-none pr-0 pl-4 font-mono text-item font-bold"
        />
        <InputGroupAddon align="inline-end" className="pl-0 text-small">
          {Number(text) === 1 ? "day" : "days"}
        </InputGroupAddon>
      </InputGroup>
      {message && (
        <p
          id={messageId}
          className={cn(
            "flex items-start gap-2 text-small font-bold",
            !labelled && "order-last basis-full pl-[3.25rem]",
          )}
        >
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          {message}
        </p>
      )}
      {hint && (
        <p
          id={messageId}
          className={cn(
            "text-small text-muted-foreground",
            !labelled && "order-last basis-full pl-[3.25rem]",
          )}
        >
          Suggested: twice the stop before, at most 365.
        </p>
      )}
    </div>
  );
}
