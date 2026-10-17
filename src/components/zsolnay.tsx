import { cn } from "@/lib/utils";

/**
 * The diamond roof tiles of Matthias Church, flat and tone-on-tone (page 21): 28 × 56 px tiles,
 * a row of diamonds with a small diamond inside, then a row of plain ones. Decoration only; text
 * never sits on it. The band at the top of Settings.
 */
export function ZsolnayBand({ className }: { className?: string }) {
  return (
    <svg aria-hidden focusable="false" className={cn("block h-[84px] w-full", className)}>
      <defs>
        <pattern id="zsolnay-tiles" width="28" height="56" patternUnits="userSpaceOnUse">
          <rect width="28" height="56" className="fill-zsolnay-ground" />
          <path d="M14 .5 27.5 14 14 27.5 .5 14Z" className="fill-zsolnay-tile" />
          <path d="M14 9 19 14 14 19 9 14Z" className="fill-zsolnay-ground" />
          <path d="M14 28.5 27.5 42 14 55.5 .5 42Z" className="fill-zsolnay-tile-alt" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#zsolnay-tiles)" />
    </svg>
  );
}
