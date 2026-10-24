import { describe, expect, it } from "vitest";
import tokens from "./tokens.css?raw";

/** Every `--name: value;` in tokens.css, first one wins (the theme block only points back). */
const declarations = new Map<string, string>();
for (const [, name, value] of tokens.matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
  if (!declarations.has(name!)) declarations.set(name!, value!.trim());
}

/** A token's colour as a hex value, following var(--…) to the primitive. */
function hex(token: string): string {
  const value = declarations.get(`--${token}`);
  if (!value) throw new Error(`No token --${token}`);
  const ref = /^var\((--[\w-]+)\)$/.exec(value);
  return ref ? hex(ref[1]!.slice(2)) : value.toUpperCase();
}

const channels = (color: string) =>
  [1, 3, 5].map((i) => Number.parseInt(color.slice(i, i + 2), 16));

/** WCAG 2.2 relative luminance. */
function luminance(color: string): number {
  const [r, g, b] = channels(color).map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function ratio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light! + 0.05) / (dark! + 0.05);
}

/** `color` at `alpha` over white, as the image number chip sits on a white image. */
function overWhite(color: string, alpha: number): string {
  const mix = channels(color).map((c) => Math.round(c * alpha + 255 * (1 - alpha)));
  return `#${mix.map((c) => c.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

// Page 22, "Text on backgrounds": [what, text token, background token, the page's ratio].
const TEXT: [string, string, string, number][] = [
  ["Foam on Dusk", "foreground", "background", 15.98],
  ["Foam on River", "card-foreground", "card", 14.52],
  ["Foam on Slate", "popover-foreground", "popover", 12.95],
  ["Foam on Swell", "secondary-foreground", "secondary", 11.4],
  ["Mist on Dusk", "muted-foreground", "background", 10.18],
  ["Mist on River", "muted-foreground", "card", 9.26],
  ["Mist on Slate", "muted-foreground", "muted", 8.25],
  ["Mist on Swell", "kbd-foreground", "kbd", 7.27],
  ["Fog on Dusk", "subtle-foreground", "background", 6.91],
  ["Fog on River", "subtle-foreground", "card", 6.28],
  ["Fog on Slate", "subtle-foreground", "muted", 5.6],
  ["Fog on Swell", "subtle-foreground", "accent", 4.93],
  ["Ink on Tram yellow", "primary-foreground", "primary", 10.93],
  ["M2 code on M2 fill", "line-m2-foreground", "line-m2-surface", 8.62],
  ["M3 code on M3 fill", "line-m3-foreground", "line-m3-surface", 8.51],
  ["M4 code on M4 fill", "line-m4-foreground", "line-m4-surface", 8.48],
  ["Ink on the key hint inside yellow", "kbd-primary-foreground", "kbd-primary", 7.94],
];

// Page 22, "Controls, rings and lines": shapes that identify a control or state.
const SHAPES: [string, string, string, number][] = [
  ["Edge against Dusk", "input", "background", 4.42],
  ["Edge against River", "input", "card", 4.02],
  ["Edge against Slate", "input", "muted", 3.58],
  ["Edge against Swell", "stop-empty", "secondary", 3.15],
  ["Tram yellow against Dusk", "ring", "background", 10.93],
  ["Tram yellow against River", "ring", "card", 9.93],
  ["Tram yellow against Slate", "ring", "popover", 8.86],
  ["Tram yellow against Swell", "ring", "secondary", 7.8],
  ["Foam against River", "stop-filled", "card", 14.52],
  ["Foam against Swell", "stop-filled", "secondary", 11.4],
  ["Mist against River", "rail", "card", 9.26],
  ["M2 line against River", "line-m2", "card", 3.82],
  ["M2 line against Dusk", "line-m2", "background", 4.2],
  ["M3 line against River", "line-m3", "card", 3.8],
  ["M3 line against Dusk", "line-m3", "background", 4.18],
  ["M4 line against River", "line-m4", "card", 3.84],
  ["M4 line against Dusk", "line-m4", "background", 4.22],
];

describe("Contrast (page 22)", () => {
  it.each(TEXT)("%s meets AA for text (4.5:1) at the page's ratio", (_, text, bg, listed) => {
    const found = ratio(hex(text), hex(bg));
    expect(found).toBeGreaterThanOrEqual(4.5);
    expect(Math.abs(found - listed)).toBeLessThan(0.011);
  });

  it.each(SHAPES)("%s meets 3:1 for controls at the page's ratio", (_, shape, bg, listed) => {
    const found = ratio(hex(shape), hex(bg));
    expect(found).toBeGreaterThanOrEqual(3);
    expect(Math.abs(found - listed)).toBeLessThan(0.011);
  });

  it("Foam on the image number chip (Dusk at 86 % over a white image) meets AA", () => {
    const chip = overWhite(hex("background"), 0.86);
    // eslint-disable-next-line no-restricted-syntax -- the mix page 22 lists, checked as written.
    expect(chip).toBe("#303744");
    expect(ratio(hex("foreground"), chip)).toBeCloseTo(10.64, 1);
  });

  it("keeps errors neutral: destructive is Foam, never red", () => {
    expect(hex("destructive")).toBe(hex("foreground"));
  });
});
