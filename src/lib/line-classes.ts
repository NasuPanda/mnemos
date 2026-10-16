import type { Line } from "@/core";

// Full class names so Tailwind can see them; the colour comes from the section's stored line.
export const LINE_CLASSES: Record<Line, { rail: string; ring: string }> = {
  m2: { rail: "bg-line-m2", ring: "border-line-m2" },
  m3: { rail: "bg-line-m3", ring: "border-line-m3" },
  m4: { rail: "bg-line-m4", ring: "border-line-m4" },
};
