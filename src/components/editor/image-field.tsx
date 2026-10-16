import {
  closestCenter,
  DndContext,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { rectSortingStrategy, SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Camera, GripVertical, ImagePlus, TriangleAlert, Upload, X } from "lucide-react";
import { useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import type { EditorImage, ImageSide } from "@/editor/form";

const TOUCH = "(hover: none) and (pointer: coarse)";

/**
 * Problem or answer images: thumbnails in order, each with its number, a handle and ×. Drag to
 * reorder (hold first on a touch screen), or focus a handle and use ← →. Paste or drop on
 * desktop; Camera or Photo library on a touch screen.
 */
export function ImageField({
  side,
  label,
  images,
  problem,
  onAdd,
  onMove,
  onRemove,
  onRetry,
}: {
  side: ImageSide;
  label: string;
  images: EditorImage[];
  problem?: string;
  onAdd: (files: File[]) => void;
  onMove: (id: string, to: number) => void;
  onRemove: (image: EditorImage) => void;
  onRetry: (image: EditorImage) => void;
}) {
  const touch = useMediaQuery(TOUCH);
  const [dropping, setDropping] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
  );
  const noun = side === "problem" ? "Problem" : "Answer";

  const move = (id: string, to: number) => {
    if (to < 0 || to >= images.length) return;
    onMove(id, to);
    setAnnouncement(`Moved to ${to + 1} of ${images.length}.`);
    requestAnimationFrame(() =>
      document.querySelector<HTMLElement>(`[data-image-handle="${id}"]`)?.focus(),
    );
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    move(
      String(active.id),
      images.findIndex((image) => image.id === over.id),
    );
  };

  const hasFiles = (event: DragEvent) => event.dataTransfer.types.includes("Files");
  const dropHandlers = {
    onDragOver: (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      setDropping(true);
    },
    onDragLeave: () => setDropping(false),
    onDrop: (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      setDropping(false);
      onAdd([...event.dataTransfer.files]);
    },
  };

  return (
    <div role="group" aria-label={label} className="flex flex-col gap-2" {...dropHandlers}>
      <span className="text-label">{label}</span>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={images.map((image) => image.id)} strategy={rectSortingStrategy}>
          <ul className="grid grid-cols-2 gap-3 pt-3 pr-3 sm:grid-cols-3 lg:flex lg:flex-wrap">
            {images.map((image, index) => (
              <Thumbnail
                key={image.id}
                image={image}
                number={index + 1}
                label={`${noun} image ${index + 1}`}
                onKey={(event) => {
                  if (event.key === "ArrowLeft") move(image.id, index - 1);
                  else if (event.key === "ArrowRight") move(image.id, index + 1);
                  else return;
                  event.preventDefault();
                }}
                onRemove={() => onRemove(image)}
                onRetry={() => onRetry(image)}
              />
            ))}
            {!touch && <PasteTile dropping={dropping} onAdd={onAdd} />}
          </ul>
        </SortableContext>
      </DndContext>
      {touch && <TouchButtons onAdd={onAdd} />}
      {problem && (
        <p role="alert" className="flex items-start gap-1.5 text-small font-bold text-foreground">
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          {problem}
        </p>
      )}
      {images.length > 0 && (
        <p className="text-small text-muted-foreground">
          {touch
            ? "Hold and drag to reorder, or use the handle. × removes."
            : "Drag to reorder, or focus a handle and use ← →. × removes."}
        </p>
      )}
      <span aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </div>
  );
}

function Thumbnail({
  image,
  number,
  label,
  onKey,
  onRemove,
  onRetry,
}: {
  image: EditorImage;
  number: number;
  label: string;
  onKey: (event: KeyboardEvent<HTMLButtonElement>) => void;
  onRemove: () => void;
  onRetry: () => void;
}) {
  const { setNodeRef, listeners, transform, transition, isDragging } = useSortable({
    id: image.id,
  });
  const busy = image.status === "preparing" || image.status === "uploading";
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("relative touch-manipulation", isDragging && "z-10")}
      {...listeners}
    >
      <div
        className={cn(
          "relative aspect-4/3 w-full overflow-hidden rounded-lg bg-foreground select-none lg:h-[100px] lg:w-[132px] [-webkit-touch-callout:none]",
          isDragging && "shadow-raised ring-2 ring-ring",
        )}
      >
        <img
          src={image.src}
          alt={label}
          draggable={false}
          className={cn("size-full object-cover", busy && "opacity-50")}
        />
        <span
          aria-hidden
          className="absolute bottom-1.5 left-1.5 grid size-6 place-items-center rounded-sm bg-background font-mono text-meta text-foreground"
        >
          {number}
        </span>
        {busy && <span className="sr-only">Uploading</span>}
        {image.status === "failed" && (
          <span className="absolute inset-0 grid place-items-center bg-background/80 p-2 text-center">
            <Button
              type="button"
              variant="secondary"
              className="h-10 gap-1.5 px-3 text-label"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={onRetry}
            >
              <TriangleAlert aria-hidden className="size-4" />
              Didn’t upload · Try again
            </Button>
          </span>
        )}
      </div>
      <Button
        type="button"
        variant="secondary"
        size="icon"
        data-image-handle={image.id}
        aria-label={`Move ${label}: ← and → change its place`}
        aria-keyshortcuts="ArrowLeft ArrowRight"
        onKeyDown={onKey}
        className="absolute right-1.5 bottom-1.5 size-9 cursor-grab rounded-md bg-background text-foreground"
      >
        <GripVertical aria-hidden className="size-4" />
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="icon"
        aria-label={`Remove ${label}`}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={onRemove}
        className="absolute -top-3 -right-3 size-10 rounded-full border-2 border-card bg-background text-foreground"
      >
        <X aria-hidden className="size-5" />
      </Button>
    </li>
  );
}

/** Desktop: "Paste Ctrl V or drop here"; a click picks files instead. */
function PasteTile({ dropping, onAdd }: { dropping: boolean; onAdd: (files: File[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <li className="list-none">
      <button
        type="button"
        onClick={() => input.current?.click()}
        className={cn(
          "flex aspect-4/3 w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-input text-small text-muted-foreground hover:bg-accent/50 lg:h-[100px] lg:w-[132px]",
          dropping && "border-solid border-ring",
        )}
      >
        <Upload aria-hidden className="size-5 text-foreground" />
        <span className="inline-flex items-center gap-1.5">
          Paste
          <KbdGroup>
            <Kbd>Ctrl</Kbd>
            <Kbd>V</Kbd>
          </KbdGroup>
        </span>
        <span>or drop here</span>
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(event) => {
          onAdd([...(event.target.files ?? [])]);
          event.target.value = "";
        }}
      />
    </li>
  );
}

/** Touch screens: the camera, or the photo library (several at once). */
function TouchButtons({ onAdd }: { onAdd: (files: File[]) => void }) {
  const camera = useRef<HTMLInputElement>(null);
  const library = useRef<HTMLInputElement>(null);
  const take = (event: React.ChangeEvent<HTMLInputElement>) => {
    onAdd([...(event.target.files ?? [])]);
    event.target.value = "";
  };
  return (
    <div className="grid grid-cols-2 gap-3">
      <Button
        type="button"
        variant="secondary"
        className="h-14 gap-2 rounded-lg text-item font-bold"
        onClick={() => camera.current?.click()}
      >
        <Camera aria-hidden className="size-5" />
        Camera
      </Button>
      <Button
        type="button"
        variant="secondary"
        className="h-14 gap-2 rounded-lg text-item font-bold"
        onClick={() => library.current?.click()}
      >
        <ImagePlus aria-hidden className="size-5" />
        Photo library
      </Button>
      <input
        ref={camera}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        aria-label="Take a photo"
        onChange={take}
      />
      <input
        ref={library}
        type="file"
        accept="image/*"
        multiple
        hidden
        aria-label="Choose photos"
        onChange={take}
      />
    </div>
  );
}
