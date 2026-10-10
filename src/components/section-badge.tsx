import { cn } from "cn";
import type { Line } from "@/core";
import { Badge } from "@/components/ui/badge";

// Full class names so Tailwind can see them. The colour comes from the section's stored line,
// never from its position in a list.
const LINE_STYLES: Record<Line, string> = {
  m2: "border-line-m2 bg-line-m2-surface text-line-m2-foreground",
  m3: "border-line-m3 bg-line-m3-surface text-line-m3-foreground",
  m4: "border-line-m4 bg-line-m4-surface text-line-m4-foreground",
};

const SIZES = {
  sm: "h-5.5 min-w-9 px-1.5",
  md: "h-6 min-w-10 px-2",
  lg: "h-8 min-w-12 px-2.5",
} as const;

/** A section's code in its line colour: "GR" on a red ring. The code identifies the section. */
export function SectionBadge({
  code,
  line,
  size = "md",
  className,
}: {
  code: string;
  line: Line;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <Badge
      className={cn(
        "rounded-full border-[1.5px] font-sans text-label font-bold tracking-[0.03em]",
        SIZES[size],
        LINE_STYLES[line],
        className,
      )}
    >
      {code}
    </Badge>
  );
}
