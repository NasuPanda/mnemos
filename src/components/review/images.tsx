import { ZoomIn } from "lucide-react";
import { cn } from "@/lib/utils";
import { imageLabel, imageUrl } from "@/lib/images";
import type { ImageDto } from "../../../worker/contract";

/**
 * Images in review: two across on desktop, full width on the phone, at most half the screen
 * high. Each keeps its own colours in a River frame; the whole image opens zoom and never
 * counts as the tap that reveals the answer.
 */
export function ImageGrid({
  images,
  onOpen,
}: {
  images: ImageDto[];
  onOpen: (image: ImageDto) => void;
}) {
  if (images.length === 0) return null;
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {images.map((image) => (
        <button
          key={image.key + image.position}
          type="button"
          data-no-reveal
          onClick={() => onOpen(image)}
          aria-label={`Zoom ${imageLabel(image).toLowerCase()}`}
          className="group relative grid place-items-center rounded-lg border border-border bg-card p-2"
        >
          <img
            src={imageUrl(image)}
            alt={imageLabel(image)}
            className="max-h-[50dvh] w-full rounded-md object-contain"
          />
          <span
            aria-hidden
            className="absolute right-3 bottom-3 grid size-10 place-items-center rounded-full bg-secondary text-secondary-foreground shadow-raised"
          >
            <ZoomIn className="size-5" />
          </span>
        </button>
      ))}
    </div>
  );
}

/** After the reveal, the problem's images shrink to thumbnails that still open zoom. */
export function Thumbnails({
  images,
  onOpen,
  className,
}: {
  images: ImageDto[];
  onOpen: (image: ImageDto) => void;
  className?: string;
}) {
  if (images.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {images.map((image) => (
        <button
          key={image.key + image.position}
          type="button"
          data-no-reveal
          onClick={() => onOpen(image)}
          aria-label={`Zoom ${imageLabel(image).toLowerCase()}`}
          className="h-[54px] w-[72px] overflow-hidden rounded-md border border-border bg-card p-1 lg:h-[60px] lg:w-[84px]"
        >
          <img src={imageUrl(image)} alt="" className="size-full object-contain" />
        </button>
      ))}
    </div>
  );
}
