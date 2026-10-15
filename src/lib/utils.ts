import { createCn } from "cn/config";

/**
 * Joins class names and resolves Tailwind conflicts. It knows the design tokens' text sizes and
 * shadows, so `text-item` (a size) and `text-primary-foreground` (a colour) don't cancel out.
 */
export const cn = createCn({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "display",
            "title",
            "heading",
            "section",
            "problem",
            "problem-sm",
            "item",
            "item-sm",
            "body",
            "small",
            "label",
            "meta",
            "code",
            "kbd",
          ],
        },
      ],
      shadow: [{ shadow: ["card", "raised", "overlay", "cta", "dock"] }],
    },
  },
});
