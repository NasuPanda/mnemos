import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useRef, useState, type PointerEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { ImageDto } from "../../../worker/contract";
import { imageLabel, imageUrl } from "@/lib/images";
import { useBackCloses } from "@/lib/router";

const MAX_SCALE = 4;

/**
 * Full-screen zoom. Phone: pinch or double-tap to zoom, swipe for the next image, Back to close.
 * Desktop: ← → and Esc, double-click to zoom. Closing returns to the item exactly as it was.
 */
export function ImageZoom({
  images,
  index,
  onIndexChange,
  onClose,
}: {
  images: ImageDto[];
  index: number | null;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const image = index === null ? undefined : images[index];
  const closeButton = useRef<HTMLButtonElement>(null);
  useBackCloses(image !== undefined, onClose);
  const go = (step: number) => {
    if (index === null || images.length === 0) return;
    onIndexChange((index + step + images.length) % images.length);
  };

  return (
    <Dialog open={image !== undefined} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        // Pinned to all four edges, not centred at 100dvh: on iPhone Safari the two differ, and
        // the controls at the bottom ended up below the toolbar, where Safari doesn't draw them.
        className="inset-0 flex max-w-none translate-none flex-col gap-0 rounded-none bg-background p-0 ring-0 sm:max-w-none"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          closeButton.current?.focus();
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") go(-1);
          if (event.key === "ArrowRight") go(1);
        }}
      >
        <header className="flex items-center justify-between px-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
          <DialogTitle className="font-mono text-meta">
            {(index ?? 0) + 1} / {images.length}
          </DialogTitle>
          <DialogDescription className="text-small text-muted-foreground">
            {image ? imageLabel(image) : ""}
          </DialogDescription>
        </header>
        {image && <ZoomableImage key={image.key + image.position} image={image} onSwipe={go} />}
        <footer className="flex items-center justify-center gap-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <Button
            variant="secondary"
            size="icon"
            className="size-12 rounded-full"
            aria-label="Previous image"
            disabled={images.length < 2}
            onClick={() => go(-1)}
          >
            <ChevronLeft aria-hidden className="size-5" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="size-14 rounded-full"
            aria-label="Close zoom"
            ref={closeButton}
            onClick={onClose}
          >
            <X aria-hidden className="size-6" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="size-12 rounded-full"
            aria-label="Next image"
            disabled={images.length < 2}
            onClick={() => go(1)}
          >
            <ChevronRight aria-hidden className="size-5" />
          </Button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}

type View = { scale: number; x: number; y: number };

/** Pinch, double-tap or double-click to zoom; drag to pan when zoomed; swipe when not. */
function ZoomableImage({ image, onSwipe }: { image: ImageDto; onSwipe: (step: number) => void }) {
  const [view, setView] = useState<View>({ scale: 1, x: 0, y: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ distance: number; scale: number; startX: number; view: View } | null>(
    null,
  );
  const lastTap = useRef(0);

  const toggleZoom = () =>
    setView((v) => (v.scale > 1 ? { scale: 1, x: 0, y: 0 } : { scale: 2, x: 0, y: 0 }));

  const onPointerDown = (event: PointerEvent) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...pointers.current.values()];
    gesture.current = {
      distance: points.length === 2 ? distance(points) : 0,
      scale: view.scale,
      startX: event.clientX,
      view,
    };
    if (event.pointerType === "touch" && points.length === 1) {
      const now = Date.now();
      if (now - lastTap.current < 300) toggleZoom();
      lastTap.current = now;
    }
  };

  const onPointerMove = (event: PointerEvent) => {
    const previous = pointers.current.get(event.pointerId);
    if (!previous || !gesture.current) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...pointers.current.values()];
    if (points.length === 2 && gesture.current.distance > 0) {
      const scale = clamp((gesture.current.scale * distance(points)) / gesture.current.distance);
      setView((v) => ({ ...v, scale }));
    } else if (points.length === 1 && view.scale > 1) {
      setView((v) => ({
        ...v,
        x: v.x + event.clientX - previous.x,
        y: v.y + event.clientY - previous.y,
      }));
    }
  };

  const onPointerUp = (event: PointerEvent) => {
    const start = gesture.current;
    pointers.current.delete(event.pointerId);
    if (pointers.current.size > 0) return;
    gesture.current = null;
    if (start && view.scale === 1 && start.distance === 0) {
      const dx = event.clientX - start.startX;
      if (Math.abs(dx) > 60) onSwipe(dx < 0 ? 1 : -1);
    }
    if (view.scale < 1.05) setView({ scale: 1, x: 0, y: 0 });
  };

  return (
    <div
      className="relative flex min-h-0 flex-1 touch-none items-center justify-center overflow-hidden px-4 select-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={toggleZoom}
    >
      <img
        src={imageUrl(image)}
        alt={imageLabel(image)}
        draggable={false}
        className="max-h-full max-w-full rounded-md object-contain"
        style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
      />
      <p className="pointer-events-none absolute bottom-3 rounded-full bg-background/80 px-3 py-1 text-label">
        <span className="[@media(pointer:fine)]:hidden">Pinch or double-tap to zoom</span>
        <span className="hidden [@media(pointer:fine)]:inline">Double-click to zoom</span>
        {" · "}
        {Math.round(view.scale * 100)} %
      </p>
    </div>
  );
}

function distance([a, b]: { x: number; y: number }[]): number {
  if (!a || !b) return 0;
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(scale: number): number {
  return Math.min(Math.max(scale, 1), MAX_SCALE);
}
