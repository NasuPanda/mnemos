import { Command as CommandPrimitive } from "cmdk";
import { Check, ChevronDown, Plus, Search } from "lucide-react";
import { useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { suggestCode, validateCode, validateSectionName, type Line } from "@/core";
import { SectionBadge } from "@/components/section-badge";
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Kbd } from "@/components/ui/kbd";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DESKTOP, useMediaQuery } from "@/hooks/use-media-query";
import { LINE_NAMES } from "@/lib/line-classes";
import { cn } from "@/lib/utils";
import { foldText } from "@/state/item-search";
import { createSection, sectionProblemMessage } from "@/state/sections";
import type { SectionDto, SectionProblem } from "../../../worker/contract";

type PickerProps = {
  sections: SectionDto[];
  nextLine: Line;
  value: number | null;
  onChange: (sectionId: number) => void;
  /** Items per section, shown on the phone's rows when known. */
  counts?: Map<number, number>;
};

/**
 * The item's section: pick one, or type a new name to create it on the spot. The new section
 * gets the suggested code (the person can type their own) and the next colour. A popover with
 * a search on desktop, a sheet at the bottom on the phone.
 */
export function SectionPicker({
  id,
  invalid,
  describedBy,
  ...props
}: PickerProps & { id: string; invalid?: boolean; describedBy?: string }) {
  const desktop = useMediaQuery(DESKTOP);
  const [open, setOpen] = useState(false);
  const selected = props.sections.find((s) => s.id === props.value);

  const trigger = (
    <button
      type="button"
      id={id}
      aria-label={
        selected ? `Section: ${selected.code} ${selected.name}` : "Section: none picked yet"
      }
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={desktop ? undefined : () => setOpen(true)}
      className="flex h-12 w-full items-center gap-3 rounded-md border border-input bg-muted px-4 text-left text-body aria-invalid:border-2 aria-invalid:border-foreground"
    >
      {selected ? (
        <>
          <SectionBadge code={selected.code} line={selected.line} />
          <span className="min-w-0 flex-1 truncate font-semibold">{selected.name}</span>
        </>
      ) : (
        <span className="flex-1 text-subtle-foreground">Pick a section</span>
      )}
      <ChevronDown aria-hidden className="size-5 shrink-0 text-muted-foreground" />
    </button>
  );

  const pick = (sectionId: number) => {
    props.onChange(sectionId);
    setOpen(false);
  };

  if (desktop) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-(--radix-popover-trigger-width) min-w-[min(420px,calc(100vw-2rem))] gap-0 rounded-lg p-0 shadow-raised"
          onEscapeKeyDown={(event) => {
            // Esc in the new section's code field only leaves the code field.
            if ((event.target as HTMLElement | null)?.dataset.codeInput) event.preventDefault();
          }}
        >
          <PickerBody {...props} onPick={pick} autoFocus />
        </PopoverContent>
      </Popover>
    );
  }
  return (
    <>
      {trigger}
      {/*
        On iPhone, vaul's own lift for the keyboard comes on top of Safari's, which pushed the
        search box off screen (issue #6). Safari alone keeps it in view: the sheet has a fixed
        height, so the search box and Create sit near the top, above the keyboard.
      */}
      <Drawer open={open} onOpenChange={setOpen} repositionInputs={false}>
        <DrawerContent className="data-[vaul-drawer-direction=bottom]:h-[85dvh] data-[vaul-drawer-direction=bottom]:max-h-none">
          <DrawerHeader className="px-4 pt-3 pb-2 text-left group-data-[vaul-drawer-direction=bottom]/drawer-content:text-left">
            <DrawerTitle className="flex items-baseline gap-2 text-heading">
              Section <span className="text-label text-muted-foreground">Required</span>
            </DrawerTitle>
            <DrawerDescription className="sr-only">
              Pick a section, or type to add a new one.
            </DrawerDescription>
          </DrawerHeader>
          <PickerBody {...props} onPick={pick} phone />
        </DrawerContent>
      </Drawer>
    </>
  );
}

function PickerBody({
  sections,
  nextLine,
  value,
  counts,
  onPick,
  autoFocus = false,
  phone = false,
}: PickerProps & { onPick: (sectionId: number) => void; autoFocus?: boolean; phone?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [codeDraft, setCodeDraft] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const name = query.trim();
  const codes = useMemo(() => sections.map((s) => s.code), [sections]);
  const folded = foldText(name);
  const matches = name
    ? sections.filter((s) => foldText(s.name).includes(folded) || foldText(s.code).includes(folded))
    : sections;
  const exact = sections.some((s) => foldText(s.name) === folded);
  const canCreate = name !== "" && !exact;
  const suggestion = name ? suggestCode(name, codes) : null;
  const code = codeDraft ?? suggestion ?? "";

  const changeQuery = (text: string) => {
    setQuery(text);
    setProblem(null);
  };

  const create = async () => {
    if (busy) return;
    const checkedName = validateSectionName(name);
    if (!checkedName.ok) return setProblem(sectionProblemMessage(`name-${checkedName.error}`));
    const checkedCode = validateCode(code, codes);
    if (!checkedCode.ok) {
      setCodeDraft(code);
      return setProblem(
        code === ""
          ? "Type a code: 2 or 3 letters or digits."
          : sectionProblemMessage(`code-${checkedCode.error}` as SectionProblem, code),
      );
    }
    setBusy(true);
    const created = await createSection(checkedName.value, checkedCode.value);
    setBusy(false);
    if (created.ok) onPick(created.value.id);
    else setProblem(created.error);
  };

  /** The code field inside the Create row keeps its own keys: Enter creates, Esc goes back. */
  const onCodeKey = (event: KeyboardEvent<HTMLInputElement>) => {
    event.stopPropagation();
    if (event.key === "Enter") {
      event.preventDefault();
      void create();
    } else if (event.key === "Escape") {
      event.preventDefault();
      setCodeDraft(null);
      setProblem(null);
      inputRef.current?.focus();
    }
  };

  const createRow = canCreate && (
    <CommandGroup heading={matches.length === 0 ? "No section matches" : "New section"}>
      <CommandItem
        value="__create"
        onSelect={() => void create()}
        className="min-h-16 gap-3 rounded-lg border-2 border-transparent px-3 py-2 data-selected:border-ring data-selected:bg-secondary"
      >
        <Plus aria-hidden className="size-5" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-item font-bold">Create “{name}”</span>
          <span className="text-small text-muted-foreground">
            {code ? `Code ${code.toUpperCase()} · ` : ""}next colour {LINE_NAMES[nextLine]}
            {codeDraft === null && suggestion ? " · you can edit the code" : ""}
          </span>
        </span>
        {codeDraft === null ? (
          <button
            type="button"
            aria-label={suggestion ? `Edit the code, ${suggestion}` : "Type a code"}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              setCodeDraft(suggestion ?? "");
            }}
            className="rounded-full"
          >
            <SectionBadge code={suggestion ?? "+"} line={nextLine} />
          </button>
        ) : (
          <input
            aria-label="Code for the new section"
            data-code-input
            autoFocus
            maxLength={3}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            value={codeDraft}
            onChange={(event) => {
              setCodeDraft(event.target.value.toUpperCase());
              setProblem(null);
            }}
            onKeyDown={onCodeKey}
            onClick={(event) => event.stopPropagation()}
            className="h-10 w-16 rounded-md border border-input bg-muted px-2 text-center font-mono text-meta uppercase"
          />
        )}
        <Kbd className="hidden lg:inline-flex">Enter</Kbd>
      </CommandItem>
      {problem && (
        <p role="alert" className="px-3 py-1.5 text-small text-foreground">
          {problem}
        </p>
      )}
    </CommandGroup>
  );

  return (
    <Command
      shouldFilter={false}
      loop
      className={cn("rounded-none! bg-transparent p-0", phone && "min-h-0 flex-1")}
    >
      <div className={cn("p-3 pb-2", phone && "px-4")}>
        <div className="flex h-12 items-center gap-2 rounded-md border border-input bg-muted px-4 has-focus-visible:outline-2 has-focus-visible:outline-offset-3 has-focus-visible:outline-ring max-lg:rounded-full">
          <Search aria-hidden className="size-5 shrink-0 text-muted-foreground" />
          <CommandPrimitive.Input
            ref={inputRef}
            autoFocus={autoFocus}
            value={query}
            onValueChange={changeQuery}
            // Nothing here reads as a person's name, so Safari doesn't offer AutoFill Contact.
            autoComplete="off"
            enterKeyHint="go"
            placeholder="Find or add a section"
            aria-label="Find or add a section"
            className="h-full min-w-0 flex-1 bg-transparent text-body outline-none"
          />
        </div>
      </div>
      <CommandList
        className={cn(
          "max-h-[min(440px,55dvh)] px-2 pb-2",
          phone && "max-h-none flex-1 px-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]",
        )}
      >
        {phone && !canCreate && (
          <button
            type="button"
            onClick={() => inputRef.current?.focus()}
            className="mb-2 flex min-h-14 w-full items-center gap-3 rounded-lg border border-border bg-card px-3 text-left"
          >
            <Plus aria-hidden className="size-5" />
            <span className="flex flex-1 flex-col">
              <span className="text-item font-bold">New section</span>
              <span className="text-small text-muted-foreground">
                Gets the next colour, {LINE_NAMES[nextLine]}
              </span>
            </span>
            <SectionBadge code="+" line={nextLine} />
          </button>
        )}
        {name && matches.length === 0 && createRow}
        {matches.length > 0 ? (
          <CommandGroup heading={name ? "Matching sections" : phone ? undefined : "All sections"}>
            {matches.map((section) => (
              <SectionRow
                key={section.id}
                section={section}
                count={counts?.get(section.id)}
                current={section.id === value}
                onSelect={() => onPick(section.id)}
                phone={phone}
              />
            ))}
          </CommandGroup>
        ) : (
          <CommandGroup heading="All sections">
            {sections.map((section) => (
              <SectionRow
                key={section.id}
                section={section}
                count={counts?.get(section.id)}
                current={section.id === value}
                onSelect={() => onPick(section.id)}
                phone={phone}
              />
            ))}
          </CommandGroup>
        )}
        {matches.length > 0 && createRow}
      </CommandList>
    </Command>
  );
}

function SectionRow({
  section,
  count,
  current,
  onSelect,
  phone,
}: {
  section: SectionDto;
  count: number | undefined;
  current: boolean;
  onSelect: () => void;
  phone: boolean;
}): ReactNode {
  return (
    <CommandItem
      value={String(section.id)}
      onSelect={onSelect}
      className={cn(
        "gap-3 rounded-lg px-3 text-body data-selected:bg-secondary",
        phone ? "min-h-14" : "min-h-11",
        current && phone && "bg-secondary",
      )}
    >
      <SectionBadge code={section.code} line={section.line} />
      <span className="min-w-0 flex-1 truncate font-semibold">{section.name}</span>
      {phone && count !== undefined && (
        <span className="font-mono text-meta text-muted-foreground">{count}</span>
      )}
      {current && <Check aria-label="Current section" className="size-5" />}
    </CommandItem>
  );
}
