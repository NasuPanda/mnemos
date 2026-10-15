import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn knows the design tokens' class names", () => {
  it("keeps a token text size next to a text colour", () => {
    expect(cn("text-primary-foreground", "text-item")).toBe("text-primary-foreground text-item");
    expect(cn("text-label", "text-line-m2-foreground")).toBe("text-label text-line-m2-foreground");
  });

  it("lets a token text size replace another size", () => {
    expect(cn("text-xs", "text-label")).toBe("text-label");
  });

  it("lets a token shadow replace another shadow", () => {
    expect(cn("shadow-sm", "shadow-card")).toBe("shadow-card");
  });
});
