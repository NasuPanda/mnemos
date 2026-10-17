import small from "@/assets/parliament-1200.webp";
import large from "@/assets/parliament-2400.webp";

/**
 * The Parliament on All done (page 21): 3:2, 1200 × 800 for phones and 2400 × 1600 for the
 * desktop, where it is 840 px wide. Static files, not R2.
 */
export const ALL_DONE_ART = {
  src: small,
  srcSet: `${small} 1200w, ${large} 2400w`,
  sizes: "(min-width: 1024px) 840px, 100vw",
  width: 2400,
  height: 1600,
} as const;

let preloading: HTMLImageElement | null = null;

/**
 * Starts loading the copy All done will pick (same srcset and sizes, same screen), so the
 * picture is there the moment the last rating lands. Once per page load.
 */
export function preloadAllDoneArt(): void {
  if (preloading) return;
  preloading = new Image();
  preloading.decoding = "async";
  // sizes first: setting srcset is what starts the load.
  preloading.sizes = ALL_DONE_ART.sizes;
  preloading.srcset = ALL_DONE_ART.srcSet;
}
