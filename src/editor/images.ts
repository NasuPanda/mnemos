import { IMAGES_PER_SIDE } from "@/core";
import type { EditorImage, ImageSide } from "./form";

export function sideImages(images: readonly EditorImage[], side: ImageSide): EditorImage[] {
  return images.filter((image) => image.side === side);
}

/** Moves an image to `to` (0-based) within its own side; the other side is untouched. */
export function moveImage(images: readonly EditorImage[], id: string, to: number): EditorImage[] {
  const image = images.find((i) => i.id === id);
  if (!image) return [...images];
  const side = sideImages(images, image.side).filter((i) => i.id !== id);
  const index = Math.max(0, Math.min(to, side.length));
  side.splice(index, 0, image);
  const other = images.filter((i) => i.side !== image.side);
  return image.side === "problem" ? [...side, ...other] : [...other, ...side];
}

/** How many of `count` new images fit on a side, which holds at most 10. */
export function roomFor(images: readonly EditorImage[], side: ImageSide, count: number): number {
  return Math.max(0, Math.min(count, IMAGES_PER_SIDE - sideImages(images, side).length));
}

/** Whether an image with this stored name is already on the side (the same picture twice). */
export function hasKey(
  images: readonly EditorImage[],
  side: ImageSide,
  key: string,
  except: string,
): boolean {
  return images.some((i) => i.side === side && i.key === key && i.id !== except);
}

export function updateImage(
  images: readonly EditorImage[],
  id: string,
  change: Partial<EditorImage>,
): EditorImage[] {
  return images.map((image) => (image.id === id ? { ...image, ...change } : image));
}
