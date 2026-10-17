import { describe, expect, it } from "vitest";
import { fitWithin, imageKey } from "./image-prep";

describe("Images › shrinking in the browser", () => {
  it("brings the longest edge down to 1,600 px, keeping the proportions", () => {
    expect(fitWithin(4032, 3024)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3024, 4032)).toEqual({ width: 1200, height: 1600 });
  });

  it("never enlarges a small image", () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it("keeps very thin images at least a pixel wide", () => {
    expect(fitWithin(10_000, 2)).toEqual({ width: 1600, height: 1 });
  });
});

describe("Images › named by their content", () => {
  it("is the SHA-256 in hex, then the type", async () => {
    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("abc"));
    const hex = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
    expect(imageKey(hash, "image/webp")).toBe(`${hex}.webp`);
    expect(imageKey(hash, "image/jpeg")).toBe(`${hex}.jpg`);
  });
});
