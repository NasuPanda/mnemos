import {
  closestCenter,
  DndContext,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Plus } from "lucide-react";
import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { toast } from "sonner";
import type { Line } from "@/core";
import { AppShell } from "@/components/app-shell";
import { SectionBadge } from "@/components/section-badge";
import { DeleteLine, LineDialog, type LineDialogMode } from "@/components/settings/line-dialog";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { count } from "@/lib/format";
import { useToday } from "@/lib/today";
import { cn } from "@/lib/utils";
import { useItemsState } from "@/state/items-store";
import { reorderSections } from "@/state/sections";
import { todayView } from "@/state/today-data";
import { useTodayState } from "@/state/today-store";
import type { SectionDto } from "../../worker/contract";

/**
 * Settings, "Menetrend": for now the lines, in order; the ladder editor and the account come
 * in phase 4.
 */
export function SettingsScreen() {
  const date = useToday();
  const today = useTodayState(date);
  const list = useItemsState(date);
  const data = today.status === "ready" ? today.data : null;
  const lines = useMemo(() => (data ? todayView(data).lines : new Map<number, number>()), [data]);
  const items = useMemo(() => {
    if (list.status !== "ready") return undefined;
    const perSection = new Map<number, number>();
    for (const item of list.items) {
      perSection.set(item.sectionId, (perSection.get(item.sectionId) ?? 0) + 1);
    }
    return perSection;
  }, [list]);

  useEffect(() => {
    if (data && window.location.hash === "#lines") {
      document.getElementById("lines")?.scrollIntoView({ block: "start" });
    }
  }, [data]);

  return (
    <AppShell sections={data?.sections ?? []} lines={lines}>
      <main className="mx-auto max-w-[1200px] px-4 pt-8 pb-12 sm:px-6 lg:px-10 lg:pt-10">
        <header className="flex flex-col gap-1 lg:flex-row lg:items-start lg:gap-10">
          <div>
            <h1 lang="hu" className="text-title lg:text-display">
              Menetrend
            </h1>
            <p className="text-small text-muted-foreground">Timetable</p>
          </div>
          <p className="mt-3 max-w-xl text-body text-muted-foreground lg:mt-2">
            Your lines, in the order the dashboard and flash review go through them. The ladder and
            your account come here next.
          </p>
        </header>
        {data && <LinesCard sections={data.sections} nextLine={data.nextLine} items={items} />}
      </main>
    </AppShell>
  );
}

function LinesCard({
  sections,
  nextLine,
  items,
}: {
  sections: SectionDto[];
  nextLine: Line;
  items: Map<number, number> | undefined;
}) {
  const [dialog, setDialog] = useState<LineDialogMode | null>(null);
  const [deleting, setDeleting] = useState<SectionDto | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
  );
  const total = items ? [...items.values()].reduce((sum, n) => sum + n, 0) : null;

  const move = async (id: number, to: number) => {
    const from = sections.findIndex((s) => s.id === id);
    if (from === -1 || to < 0 || to >= sections.length || to === from) return;
    const ids = arrayMove(sections, from, to).map((s) => s.id);
    setAnnouncement(`Moved to ${to + 1} of ${sections.length}.`);
    requestAnimationFrame(() =>
      document.querySelector<HTMLElement>(`[data-line-handle="${id}"]`)?.focus(),
    );
    const saved = await reorderSections(ids);
    if (!saved.ok) toast(saved.error);
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    void move(
      Number(active.id),
      sections.findIndex((s) => s.id === over.id),
    );
  };

  return (
    <section
      id="lines"
      aria-labelledby="lines-title"
      className="mt-8 scroll-mt-8 rounded-xl bg-card p-4 shadow-card lg:p-6"
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h2 id="lines-title" className="text-heading">
            Lines
          </h2>
          <p className="font-mono text-meta text-muted-foreground">
            {count(sections.length, "line")}
            {total !== null && ` · ${count(total, "item")}`}
          </p>
        </div>
        <Button
          variant="secondary"
          className="h-12 gap-2 px-4 text-item font-bold"
          onClick={() => setDialog({ kind: "new" })}
        >
          <Plus aria-hidden className="size-5" />
          New line
        </Button>
      </header>

      {sections.length === 0 ? (
        <Empty className="mt-4">
          <EmptyHeader>
            <EmptyTitle>No lines yet</EmptyTitle>
            <EmptyDescription>
              Make one here, or type a new name in the item editor’s section picker.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext
              items={sections.map((s) => s.id)}
              strategy={verticalListSortingStrategy}
            >
              <ol className="mt-4">
                {sections.map((section, index) => (
                  <LineRow
                    key={section.id}
                    section={section}
                    items={items?.get(section.id)}
                    onKey={(event) => {
                      if (event.key === "ArrowUp") void move(section.id, index - 1);
                      else if (event.key === "ArrowDown") void move(section.id, index + 1);
                      else return;
                      event.preventDefault();
                    }}
                    onEdit={() => setDialog({ kind: "edit", section })}
                  />
                ))}
              </ol>
            </SortableContext>
          </DndContext>
          <p className="mt-3 text-small text-muted-foreground">
            Drag a handle to reorder, or focus it and use ↑ ↓. Colours never change; the code tells
            lines apart.
          </p>
        </>
      )}
      <span aria-live="polite" className="sr-only">
        {announcement}
      </span>

      <LineDialog
        mode={dialog}
        onClose={() => setDialog(null)}
        onAskDelete={(section) => {
          setDialog(null);
          setDeleting(section);
        }}
        sections={sections}
        nextLine={nextLine}
      />
      <DeleteLine
        section={deleting}
        items={deleting ? (items?.get(deleting.id) ?? 0) : 0}
        onClose={() => setDeleting(null)}
      />
    </section>
  );
}

function LineRow({
  section,
  items,
  onKey,
  onEdit,
}: {
  section: SectionDto;
  items: number | undefined;
  onKey: (event: KeyboardEvent<HTMLButtonElement>) => void;
  onEdit: () => void;
}) {
  const { setNodeRef, listeners, transform, transition, isDragging } = useSortable({
    id: section.id,
  });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "relative flex min-h-14 items-center gap-2 border-b border-border bg-card last:border-0",
        isDragging && "z-10 rounded-lg shadow-raised ring-2 ring-ring",
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        data-line-handle={section.id}
        aria-label={`Move ${section.code} ${section.name}: ↑ and ↓ change its place`}
        aria-keyshortcuts="ArrowUp ArrowDown"
        onKeyDown={onKey}
        className="size-12 shrink-0 cursor-grab touch-none text-muted-foreground"
        {...listeners}
      >
        <GripVertical aria-hidden className="size-5" />
      </Button>
      <button
        type="button"
        onClick={onEdit}
        className="flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-lg px-2 text-left hover:bg-accent/60"
      >
        <SectionBadge code={section.code} line={section.line} />
        <span className="min-w-0 flex-1 truncate text-item font-semibold">{section.name}</span>
        {items !== undefined && (
          <span className="font-mono text-meta text-muted-foreground">{count(items, "item")}</span>
        )}
        <span className="hidden items-center gap-1.5 px-2 text-label text-muted-foreground lg:inline-flex">
          <Pencil aria-hidden className="size-4" />
          Edit
        </span>
        <span className="sr-only lg:hidden">, edit</span>
      </button>
    </li>
  );
}
