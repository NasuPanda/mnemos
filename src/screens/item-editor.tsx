import { Check, Ellipsis, Link2, Trash2, X } from "lucide-react";
import { useEffect, useEffectEvent, useId, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { daysLate, type IsoDate } from "@/core";
import { AppShell } from "@/components/app-shell";
import {
  EditorField,
  GrowingTextarea,
  CodeButton,
  MarkdownField,
} from "@/components/editor/fields";
import { SectionPicker } from "@/components/editor/section-picker";
import { Link } from "@/components/link";
import { Overdue } from "@/components/overdue";
import { StopIndicator } from "@/components/stop-indicator";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { DESKTOP, useMediaQuery } from "@/hooks/use-media-query";
import { ApiError } from "@/lib/api";
import { count, shortDate } from "@/lib/format";
import { leave, useBackGuard, useLocation } from "@/lib/router";
import { useToday } from "@/lib/today";
import {
  checkForm,
  describedBy,
  emptyForm,
  FIELD_ORDER,
  formFromItem,
  isDirty,
  problemMessages,
  toRequest,
  type FormField,
  type FormProblems,
  type ItemForm,
} from "@/editor/form";
import { deleteItem, lastSection, loadItem, rememberSection, saveItem } from "@/state/item-actions";
import { useItemsState } from "@/state/items-store";
import { todayView, type TodayData } from "@/state/today-data";
import { useTodayState } from "@/state/today-store";
import type { ItemDto, ItemErrorResponse } from "../../worker/contract";

type Loaded =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "failed" }
  | { status: "ready"; item: ItemDto; reviews: number | null };

/**
 * The item for the editor. An item on today's list opens at once from today's data; the
 * Worker's copy, with its review count, follows.
 */
function useEditorItem(itemId: number | null, data: TodayData | null): Loaded {
  const [fetched, setFetched] = useState<{ id: number; loaded: Loaded } | null>(null);
  useEffect(() => {
    if (itemId === null) return;
    let live = true;
    loadItem(itemId)
      .then(({ item, reviews }) => {
        if (live) setFetched({ id: itemId, loaded: { status: "ready", item, reviews } });
      })
      .catch((error: unknown) => {
        const status = error instanceof ApiError && error.status === 404 ? "missing" : "failed";
        if (live) setFetched({ id: itemId, loaded: { status } });
      });
    return () => {
      live = false;
    };
  }, [itemId]);

  if (itemId === null) return { status: "loading" };
  if (fetched?.id === itemId && fetched.loaded.status !== "failed") return fetched.loaded;
  const cached = data?.items.find((item) => item.id === itemId);
  if (cached) return { status: "ready", item: cached, reviews: null };
  return fetched?.id === itemId ? fetched.loaded : { status: "loading" };
}

/** The item editor: /items/new (optionally ?section=ID) or /items/<id>. */
export function ItemEditorScreen({ itemId }: { itemId: number | null }) {
  const date = useToday();
  const today = useTodayState(date);
  const data = today.status === "ready" ? today.data : null;
  const lines = useMemo(() => (data ? todayView(data).lines : new Map<number, number>()), [data]);
  const loaded = useEditorItem(itemId, data);
  const { query } = useLocation();

  const requested = Number(query.get("section"));
  const startSection = [requested, lastSection()].find(
    (id): id is number => id !== null && !!data?.sections.some((section) => section.id === id),
  );

  let body = null;
  if (itemId !== null && (loaded.status === "missing" || loaded.status === "failed")) {
    body = <NotHere missing={loaded.status === "missing"} />;
  } else if (data && itemId === null) {
    body = (
      <Editor date={date} data={data} item={null} reviews={null} startSection={startSection} />
    );
  } else if (data && loaded.status === "ready") {
    body = (
      <Editor
        key={loaded.item.id}
        date={date}
        data={data}
        item={loaded.item}
        reviews={loaded.reviews}
        startSection={undefined}
      />
    );
  }

  return (
    <AppShell sections={data?.sections ?? []} lines={lines} tabBar={false}>
      {body}
    </AppShell>
  );
}

function Editor({
  date,
  data,
  item,
  reviews,
  startSection,
}: {
  date: IsoDate;
  data: TodayData;
  item: ItemDto | null;
  reviews: number | null;
  startSection: number | undefined;
}) {
  const desktop = useMediaQuery(DESKTOP);
  const items = useItemsState(date);
  const [initial] = useState<ItemForm>(() =>
    item ? formFromItem(item) : emptyForm(startSection ?? null),
  );
  const [form, setForm] = useState<ItemForm>(initial);
  const [problems, setProblems] = useState<FormProblems>({});
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [asking, setAsking] = useState<"discard" | "delete" | null>(null);
  const dirty = isDirty(initial, form);

  const ids = {
    name: useId(),
    sectionId: useId(),
    description: useId(),
    problemText: useId(),
    problemUrl: useId(),
    answerText: useId(),
    answerUrl: useId(),
    sideNote: useId(),
  } satisfies Record<FormField, string>;
  const nameRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  const section = data.sections.find((s) => s.id === form.sectionId);
  const counts = useMemo(() => {
    if (items.status !== "ready") return undefined;
    const perSection = new Map<number, number>();
    for (const i of items.items)
      perSection.set(i.sectionId, (perSection.get(i.sectionId) ?? 0) + 1);
    return perSection;
  }, [items]);

  /** Once a save was refused, problems update as the person types. */
  const change = (next: Partial<ItemForm>) => {
    const updated = { ...form, ...next };
    setForm(updated);
    if (checked) setProblems(checkForm(updated));
  };

  // Stays on while saving, so leaving after the save takes the guard off in the same step.
  const { rearm } = useBackGuard(dirty, () => setAsking("discard"));

  const cancel = () => {
    if (dirty) setAsking("discard");
    else leave("/items");
  };

  const save = async () => {
    if (saving) return;
    const found = checkForm(form);
    setChecked(true);
    setProblems(found);
    const first = FIELD_ORDER.find((field) => found[field]);
    if (first || form.sectionId === null) {
      if (first) document.getElementById(ids[first])?.focus();
      return;
    }
    setSaving(true);
    try {
      await saveItem(item?.id ?? null, toRequest({ ...form, sectionId: form.sectionId }), date);
      rememberSection(form.sectionId);
      leave("/items");
    } catch (error) {
      setSaving(false);
      refused(error);
    }
  };

  const refused = (error: unknown) => {
    const body = error instanceof ApiError ? (error.body as ItemErrorResponse | null) : null;
    if (body?.error === "invalid-fields" && body.fields) {
      setProblems(problemMessages(body.fields));
    } else if (body?.error === "section-not-found") {
      setProblems({ sectionId: "That section is gone. Pick another, or create it again." });
    } else if (body?.error === "images-limit") {
      toast("You’ve reached 2,000 images. Remove some from other items first.");
    } else {
      toast("That didn’t save. Check your connection and try again.");
    }
  };

  const remove = async () => {
    if (!item) return;
    try {
      await deleteItem(item.id);
      setAsking(null);
      leave("/items");
    } catch {
      toast("That didn’t delete. Check your connection and try again.");
    }
  };

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.isComposing || event.defaultPrevented) return;
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      void save();
    } else if (event.key === "Escape" && asking === null && !openLayer()) {
      event.preventDefault();
      cancel();
    }
  });
  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKeyDown(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  const late = item ? daysLate(item.dueOn, date) : 0;
  const title = item ? "Edit item" : "New item";

  const nameHelp = desktop
    ? "Shown in lists and on the dashboard. Hidden in review until you show the answer, unless the problem description is empty."
    : "Hidden in review until the answer, unless the problem description is empty.";

  return (
    <main className="pb-36 lg:pb-16">
      {/* Phone: close, title, and the ··· menu. */}
      <header className="sticky top-0 z-20 grid h-16 grid-cols-[3rem_1fr_3rem] items-center border-b border-border bg-background px-2 lg:hidden">
        <Button variant="ghost" size="icon" className="size-12" aria-label="Close" onClick={cancel}>
          <X aria-hidden className="size-6" />
        </Button>
        <h1 className="text-center text-heading">{title}</h1>
        {item && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-12" aria-label="More">
                <Ellipsis aria-hidden className="size-6" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-52 rounded-lg p-1.5 shadow-raised">
              <DropdownMenuItem
                className="h-12 gap-3 text-body"
                onSelect={() => setAsking("delete")}
              >
                <Trash2 aria-hidden className="size-5" />
                Delete item…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </header>

      {/* Desktop: the bar with Save stays at the top while you scroll. */}
      <header className="sticky top-0 z-20 hidden border-b border-border bg-background lg:block">
        <div className="mx-auto flex max-w-[1200px] items-end justify-between gap-6 px-10 pt-6 pb-5">
          <div className="min-w-0">
            <nav aria-label="Breadcrumb" className="text-small text-muted-foreground">
              <Link to="/items" className="underline underline-offset-3">
                Items
              </Link>
              {section && (
                <>
                  {" › "}
                  <Link to={`/items?line=${section.id}`} className="underline underline-offset-3">
                    {section.name}
                  </Link>
                </>
              )}
            </nav>
            <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1">
              <h1 className="text-title">{title}</h1>
              {item ? (
                <p className="flex flex-wrap items-center gap-x-4 text-muted-foreground">
                  <StopIndicator stop={item.stop} stops={data.ladder.length} long />
                  <span className="font-mono text-meta">due {shortDate(item.dueOn)}</span>
                  <Overdue days={late} />
                </p>
              ) : (
                <p className="text-small text-muted-foreground">Starts on stop 1, due today.</p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <Button
              variant="ghost"
              className="h-12 gap-2 px-4 text-item font-bold"
              onClick={cancel}
            >
              Cancel
              <Kbd>Esc</Kbd>
            </Button>
            <Button
              className="h-12 gap-2.5 rounded-full px-6 text-item font-bold"
              onClick={() => void save()}
              disabled={saving}
            >
              <Check aria-hidden className="size-5" />
              {saving ? "Saving…" : "Save"}
              <KbdGroup className="ml-1">
                <Kbd>Ctrl</Kbd>
                <Kbd>Enter</Kbd>
              </KbdGroup>
            </Button>
          </div>
        </div>
      </header>

      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
        className="mx-auto max-w-[1200px] px-4 pt-5 sm:px-6 lg:px-10 lg:pt-8"
      >
        <div className="grid gap-x-5 gap-y-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <EditorField
            label="Name"
            htmlFor={ids.name}
            required
            help={nameHelp}
            error={problems.name}
            actions={<CodeButton target={nameRef} onEdit={(name) => change({ name })} />}
          >
            <Input
              ref={nameRef}
              id={ids.name}
              value={form.name}
              autoFocus={item === null && desktop}
              autoComplete="off"
              aria-invalid={!!problems.name || undefined}
              aria-describedby={describedBy(ids.name, problems.name, true)}
              onChange={(event) => change({ name: event.target.value })}
            />
          </EditorField>

          <EditorField
            label="Section"
            htmlFor={ids.sectionId}
            required
            help="Pick one, or type a new name to create it."
            error={problems.sectionId}
          >
            <SectionPicker
              id={ids.sectionId}
              sections={data.sections}
              nextLine={data.nextLine}
              value={form.sectionId}
              counts={counts}
              invalid={!!problems.sectionId}
              describedBy={describedBy(ids.sectionId, problems.sectionId, true)}
              onChange={(sectionId) => change({ sectionId })}
            />
          </EditorField>

          <EditorField
            label="Description"
            htmlFor={ids.description}
            help="Short context, shown above the problem."
            error={problems.description}
            className="lg:col-span-2"
            actions={
              <CodeButton
                target={descriptionRef}
                onEdit={(description) => change({ description })}
              />
            }
          >
            <GrowingTextarea
              ref={descriptionRef}
              id={ids.description}
              rows={1}
              value={form.description}
              aria-invalid={!!problems.description || undefined}
              aria-describedby={describedBy(ids.description, problems.description, true)}
              onChange={(event) => change({ description: event.target.value })}
              className="min-h-12 py-2.5"
            />
          </EditorField>
        </div>

        <div className="mt-8 grid items-start gap-x-5 gap-y-8 desk:grid-cols-2">
          <Side title="Problem side" note="Shown first in review.">
            <MarkdownField
              id={ids.problemText}
              label="Problem description"
              value={form.problemText}
              onChange={(problemText) => change({ problemText })}
              help="Leave empty to use the name as the question."
              error={problems.problemText}
            />
            <ImagesForNow form={form} side="problem" onChange={change} />
            <LinkField
              id={ids.problemUrl}
              label="Problem URL"
              value={form.problemUrl}
              onChange={(problemUrl) => change({ problemUrl })}
              help="Opens as usual; it never reveals the answer."
              error={problems.problemUrl}
            />
          </Side>

          <Side title="Answer side" note="Shown after you reveal the answer.">
            <MarkdownField
              id={ids.answerText}
              label="Answer text"
              value={form.answerText}
              onChange={(answerText) => change({ answerText })}
              error={problems.answerText}
            />
            <ImagesForNow form={form} side="answer" onChange={change} />
            <LinkField
              id={ids.answerUrl}
              label="Answer URL"
              value={form.answerUrl}
              onChange={(answerUrl) => change({ answerUrl })}
              error={problems.answerUrl}
            />
            <MarkdownField
              id={ids.sideNote}
              label="Side note"
              value={form.sideNote}
              onChange={(sideNote) => change({ sideNote })}
              help="Tips or reminders for next time. Shown last, just above the confidence buttons."
              error={problems.sideNote}
            />
          </Side>
        </div>

        {item && (
          <div className="mt-10 hidden border-t border-border pt-6 lg:block">
            <Button
              type="button"
              variant="secondary"
              className="h-12 gap-2 px-5 text-item font-bold"
              onClick={() => setAsking("delete")}
            >
              <Trash2 aria-hidden className="size-5" />
              Delete item…
            </Button>
          </div>
        )}

        {/* Phone: Save at the bottom, in thumb reach. */}
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] lg:hidden">
          <Button
            type="submit"
            disabled={saving}
            className="h-14 w-full gap-2.5 rounded-full text-item font-bold"
          >
            <Check aria-hidden className="size-5" />
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>

      <AlertDialog
        open={asking === "discard"}
        onOpenChange={(open) => {
          if (open) return;
          setAsking(null);
          rearm();
        }}
      >
        <AlertDialogContent className="rounded-lg p-6 shadow-overlay">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-heading">Discard your changes?</AlertDialogTitle>
            <AlertDialogDescription className="text-body">
              {item ? "The item stays as it was." : "The new item won’t be added."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="m-0 border-0 bg-transparent p-0">
            <AlertDialogCancel className="h-12 px-5 text-item font-bold" autoFocus>
              Keep editing
            </AlertDialogCancel>
            <Button
              variant="secondary"
              className="h-12 px-5 text-item font-bold"
              onClick={() => {
                setAsking(null);
                leave("/items");
              }}
            >
              Discard
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={asking === "delete"} onOpenChange={(open) => !open && setAsking(null)}>
        <AlertDialogContent className="rounded-lg p-6 shadow-overlay">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-heading">Delete this item?</AlertDialogTitle>
            <AlertDialogDescription className="text-body">
              {reviews === null
                ? "Its review history goes with it."
                : reviews === 0
                  ? "It has no reviews yet."
                  : `Its ${count(reviews, "review")} go with it.`}{" "}
              This can’t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="m-0 border-0 bg-transparent p-0">
            <AlertDialogCancel className="h-12 px-5 text-item font-bold" autoFocus>
              Cancel
              <Kbd className="hidden lg:inline-flex">Esc</Kbd>
            </AlertDialogCancel>
            <Button
              variant="secondary"
              className="h-12 gap-2 px-5 text-item font-bold"
              onClick={() => void remove()}
            >
              <Trash2 aria-hidden className="size-5" />
              Delete item
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}

/** One side of the item: a card on desktop, a titled part of the page on the phone. */
function Side({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-6 border-t border-border pt-6 lg:rounded-xl lg:border-0 lg:bg-card lg:p-6 lg:shadow-card">
      <header>
        <h2 className="text-heading">{title}</h2>
        <p className="text-small text-muted-foreground">{note}</p>
      </header>
      {children}
    </section>
  );
}

function LinkField({
  id,
  label,
  value,
  onChange,
  help,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  help?: string;
  error?: string;
}) {
  return (
    <EditorField label={label} htmlFor={id} help={help} error={error}>
      <InputGroup>
        <InputGroupAddon>
          <Link2 aria-hidden className="size-5" />
        </InputGroupAddon>
        <InputGroupInput
          id={id}
          type="url"
          inputMode="url"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="example.edu/notes"
          value={value}
          aria-invalid={!!error || undefined}
          aria-describedby={describedBy(id, error, !!help)}
          onChange={(event) => onChange(event.target.value)}
        />
      </InputGroup>
    </EditorField>
  );
}

/** The item's stored images, until the image field arrives. */
function ImagesForNow({
  form,
  side,
  onChange,
}: {
  form: ItemForm;
  side: "problem" | "answer";
  onChange: (next: Partial<ItemForm>) => void;
}) {
  const images = form.images.filter((image) => image.side === side);
  if (images.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-3">
      {images.map((image, index) => (
        <div key={image.id} className="relative">
          <img
            src={image.src}
            alt={`${side === "problem" ? "Problem" : "Answer"} image ${index + 1}`}
            className="h-24 w-32 rounded-lg bg-foreground object-contain"
          />
          <Button
            type="button"
            variant="secondary"
            size="icon"
            aria-label={`Remove image ${index + 1}`}
            className="absolute -top-3 -right-3 size-9 rounded-full"
            onClick={() => onChange({ images: form.images.filter((i) => i.id !== image.id) })}
          >
            <X aria-hidden className="size-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}

function NotHere({ missing }: { missing: boolean }) {
  return (
    <main className="mx-auto max-w-[1200px] px-4 pt-8 sm:px-6 lg:px-10 lg:pt-10">
      <Empty>
        <EmptyHeader>
          <EmptyTitle>{missing ? "This item is gone" : "This item didn’t load"}</EmptyTitle>
          <EmptyDescription>
            {missing
              ? "It may have been deleted, perhaps in another tab."
              : "Check your connection, then try again."}
          </EmptyDescription>
        </EmptyHeader>
        <Button asChild variant="secondary" className="h-12 px-5">
          <Link to="/items">Back to Items</Link>
        </Button>
      </Empty>
    </main>
  );
}

/** Whether a popover, menu or sheet is open: Esc closes that first, not the editor. */
function openLayer(): boolean {
  return !!document.querySelector(
    '[data-slot="popover-content"], [data-slot="dropdown-menu-content"], [data-slot="drawer-content"], [data-slot="alert-dialog-content"], [data-slot="dialog-content"]',
  );
}
