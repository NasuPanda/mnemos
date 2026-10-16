import { Check, Trash2 } from "lucide-react";
import { useId, useState, type FormEvent, type ReactNode } from "react";
import { suggestCode, validateCode, validateSectionName, type Line } from "@/core";
import { Confirm } from "@/components/confirm";
import { EditorField } from "@/components/editor/fields";
import { SectionBadge } from "@/components/section-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { DESKTOP, useMediaQuery } from "@/hooks/use-media-query";
import { count } from "@/lib/format";
import { LINE_NAMES } from "@/lib/line-classes";
import { describedBy } from "@/editor/form";
import {
  createSection,
  deleteSection,
  sectionProblemMessage,
  updateSection,
} from "@/state/sections";
import type { SectionDto } from "../../../worker/contract";

/** Which line the dialog is about: a new one, or one to rename, recode or delete. */
export type LineDialogMode = { kind: "new" } | { kind: "edit"; section: SectionDto };

/**
 * A line's name and code, as a dialog on desktop and a sheet on the phone. Its colour is shown
 * but never changes: it was set when the line was made. Delete asks first, naming how many
 * items go with the line.
 */
export function LineDialog({
  mode,
  onClose,
  onAskDelete,
  sections,
  nextLine,
}: {
  mode: LineDialogMode | null;
  onClose: () => void;
  /** Delete line…: the dialog closes and the question is asked in its place. */
  onAskDelete: (section: SectionDto) => void;
  sections: SectionDto[];
  nextLine: Line;
}) {
  const desktop = useMediaQuery(DESKTOP);
  const open = mode !== null;
  const title = mode?.kind === "edit" ? "Edit line" : "New line";
  const body = mode && (
    <LineForm
      key={mode.kind === "edit" ? mode.section.id : "new"}
      mode={mode}
      sections={sections}
      nextLine={nextLine}
      onDone={onClose}
      onAskDelete={onAskDelete}
    />
  );
  const description = "A line’s code tells it apart; its colour stays as it was made.";

  if (desktop) {
    return (
      <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
        <DialogContent
          showCloseButton={false}
          className="max-w-lg! gap-5 rounded-lg p-6 shadow-overlay"
        >
          <DialogHeader>
            <DialogTitle className="text-heading">{title}</DialogTitle>
            <DialogDescription className="sr-only">{description}</DialogDescription>
          </DialogHeader>
          {body}
        </DialogContent>
      </Dialog>
    );
  }
  return (
    <Drawer open={open} onOpenChange={(next) => !next && onClose()}>
      <DrawerContent className="max-h-[92dvh]">
        <DrawerHeader className="px-5 pt-3 pb-0 text-left group-data-[vaul-drawer-direction=bottom]/drawer-content:text-left">
          <DrawerTitle className="text-heading">{title}</DrawerTitle>
          <DrawerDescription className="sr-only">{description}</DrawerDescription>
        </DrawerHeader>
        <div className="overflow-y-auto px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {body}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function LineForm({
  mode,
  sections,
  nextLine,
  onDone,
  onAskDelete,
}: {
  mode: LineDialogMode;
  sections: SectionDto[];
  nextLine: Line;
  onDone: () => void;
  onAskDelete: (section: SectionDto) => void;
}) {
  const editing = mode.kind === "edit" ? mode.section : null;
  const otherCodes = sections.filter((s) => s.id !== editing?.id).map((s) => s.code);
  const [name, setName] = useState(editing?.name ?? "");
  const [code, setCode] = useState(editing?.code ?? "");
  // A new line's code follows the name's suggestion until the person types their own.
  const [ownCode, setOwnCode] = useState(editing !== null);
  const [problems, setProblems] = useState<{ name?: string; code?: string; other?: string }>({});
  const [busy, setBusy] = useState(false);
  const ids = { name: useId(), code: useId() };
  const shownCode = ownCode ? code : (suggestCode(name, otherCodes) ?? "");
  const line = editing?.line ?? nextLine;

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const checkedName = validateSectionName(name);
    const checkedCode = validateCode(shownCode, otherCodes);
    const found = {
      name: checkedName.ok ? undefined : sectionProblemMessage(`name-${checkedName.error}`),
      code: checkedCode.ok
        ? undefined
        : sectionProblemMessage(`code-${checkedCode.error}`, shownCode),
    };
    setProblems(found);
    if (!checkedName.ok) return document.getElementById(ids.name)?.focus();
    if (!checkedCode.ok) return document.getElementById(ids.code)?.focus();

    setBusy(true);
    const saved = editing
      ? await updateSection(editing.id, { name: checkedName.value, code: checkedCode.value })
      : await createSection(checkedName.value, checkedCode.value);
    setBusy(false);
    if (saved.ok) onDone();
    else setProblems({ other: saved.error });
  };

  return (
    <form noValidate onSubmit={(event) => void save(event)} className="flex flex-col gap-5">
      <EditorField label="Name" htmlFor={ids.name} required error={problems.name}>
        <Input
          id={ids.name}
          value={name}
          maxLength={80}
          autoComplete="off"
          aria-invalid={!!problems.name || undefined}
          aria-describedby={describedBy(ids.name, problems.name, false)}
          onChange={(event) => setName(event.target.value)}
        />
      </EditorField>
      <EditorField
        label="Code"
        htmlFor={ids.code}
        required
        help="2 or 3 letters or digits. The code, not the colour, tells lines apart."
        error={problems.code}
      >
        <Input
          id={ids.code}
          value={shownCode}
          maxLength={3}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          aria-invalid={!!problems.code || undefined}
          aria-describedby={describedBy(ids.code, problems.code, true)}
          onChange={(event) => {
            setOwnCode(true);
            setCode(event.target.value.toUpperCase());
          }}
          className="w-28 font-mono uppercase"
        />
      </EditorField>
      <div className="flex items-center gap-3">
        <SectionBadge code={shownCode.trim() || "··"} line={line} size="lg" />
        <p className="text-small text-muted-foreground">
          {editing
            ? `${LINE_NAMES[line]}, set when the line was made.`
            : `${LINE_NAMES[line]}, the next colour.`}
        </p>
      </div>
      {problems.other && (
        <p role="alert" className="text-small font-bold text-foreground">
          {problems.other}
        </p>
      )}

      <Footer>
        {editing && (
          <Button
            type="button"
            variant="secondary"
            className="h-12 gap-2 px-4 text-item font-bold max-lg:order-last max-lg:w-full max-lg:rounded-full"
            onClick={() => onAskDelete(editing)}
          >
            <Trash2 aria-hidden className="size-5" />
            Delete line…
          </Button>
        )}
        <span className="flex-1 max-lg:hidden" />
        <Button
          type="button"
          variant="ghost"
          className="h-12 px-4 text-item font-bold max-lg:hidden"
          onClick={onDone}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={busy}
          className="h-12 gap-2 rounded-full px-6 text-item font-bold max-lg:h-14 max-lg:w-full"
        >
          <Check aria-hidden className="size-5" />
          {editing ? "Save" : "Create line"}
        </Button>
      </Footer>
    </form>
  );
}

function Footer({ children }: { children: ReactNode }) {
  return <div className="mt-1 flex flex-col gap-3 lg:flex-row lg:items-center">{children}</div>;
}

/** Delete a line: it asks first, naming how many items and reviews go with it. */
export function DeleteLine({
  section,
  items,
  onClose,
}: {
  section: SectionDto | null;
  items: number;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const remove = async () => {
    if (!section) return;
    setBusy(true);
    const deleted = await deleteSection(section.id);
    setBusy(false);
    if (deleted.ok) onClose();
    else setProblem(deleted.error);
  };
  return (
    <Confirm
      open={section !== null}
      onOpenChange={(open) => {
        if (open) return;
        setProblem(null);
        onClose();
      }}
      title={section ? `Delete ${section.code} · ${section.name}?` : ""}
      description={
        problem ??
        (items === 0
          ? "It has no items. This can’t be undone."
          : `Its ${count(items, "item")} and their reviews are deleted too. This can’t be undone.`)
      }
      confirmLabel={items === 0 ? "Delete line" : `Delete line and ${count(items, "item")}`}
      confirmIcon={<Trash2 aria-hidden className="size-5" />}
      busy={busy}
      onConfirm={() => void remove()}
    />
  );
}
