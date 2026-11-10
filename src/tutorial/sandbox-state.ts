import { DEFAULT_LADDER, FIRST_LINE, type Line } from "@/core";
import type { ImageDto, ItemDto, ReviewDto, SectionDto } from "../../worker/contract";

/**
 * The practice day's data: the Worker's six tables as plain arrays, for one person. Plain JSON,
 * so the tutorial can keep it in sessionStorage and pick up after a reload.
 */
export type SandboxState = {
  /** Goes up when the shape changes; a saved practice day of another version starts again. */
  version: 1;
  settings: { ladder: number[]; nextLine: Line };
  /** In creation order. */
  sections: SectionDto[];
  /** In creation order; images live in `images`. */
  items: Omit<ItemDto, "images">[];
  images: (ImageDto & { itemId: number })[];
  /** In the order they were made. */
  reviews: ReviewDto[];
  /** The last id given out, per table. */
  lastId: { section: number; item: number; review: number };
};

/** An account with nothing in it yet: the default ladder, and M2 for the first line. */
export function emptySandbox(): SandboxState {
  return {
    version: 1,
    settings: { ladder: [...DEFAULT_LADDER], nextLine: FIRST_LINE },
    sections: [],
    items: [],
    images: [],
    reviews: [],
    lastId: { section: 0, item: 0, review: 0 },
  };
}
