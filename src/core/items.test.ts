import { describe, expect, it } from "vitest";
import {
  checkItemImages,
  checkItemText,
  IMAGES_PER_SIDE,
  isImageKey,
  ITEM_LIMITS,
  normalizeUrl,
} from "./items";

const key = (n: number, type = "webp") => `${n.toString(16).padStart(64, "0")}.${type}`;

describe("Item fields › Name and Description", () => {
  it("needs a Name; every other field may be empty", () => {
    expect(checkItemText({ name: "  " })).toEqual({ ok: false, error: { name: "required" } });
    expect(checkItemText({ name: "Heapify in `O(n)`" })).toEqual({
      ok: true,
      value: {
        name: "Heapify in `O(n)`",
        description: null,
        problemUrl: null,
        problemText: null,
        answerUrl: null,
        answerText: null,
        sideNote: null,
      },
    });
  });

  it("drops surrounding spaces and stores empty fields as nothing", () => {
    const checked = checkItemText({ name: " Kruskal vs Prim ", description: "   " });
    expect(checked.ok && checked.value).toMatchObject({
      name: "Kruskal vs Prim",
      description: null,
    });
  });

  it("keeps a Name to 300 characters and a Description to 1,000", () => {
    const checked = checkItemText({
      name: "x".repeat(ITEM_LIMITS.name + 1),
      description: "y".repeat(ITEM_LIMITS.description + 1),
    });
    expect(checked).toEqual({
      ok: false,
      error: { name: "too-long", description: "too-long" },
    });
  });
});

describe("Item fields › Markdown fields", () => {
  it("keep their text, indentation included, but lose blank lines and spaces at the ends", () => {
    const checked = checkItemText({
      name: "Dijkstra",
      answerText: "\n\n    pop S   A = 2\n    pop A\n\n  ",
    });
    expect(checked.ok && checked.value.answerText).toBe("    pop S   A = 2\n    pop A");
  });

  it("take up to 20,000 characters each", () => {
    const long = "x".repeat(ITEM_LIMITS.markdown + 1);
    const checked = checkItemText({ name: "Long", problemText: long, sideNote: long });
    expect(checked).toEqual({
      ok: false,
      error: { problemText: "too-long", sideNote: "too-long" },
    });
  });
});

describe("Item fields › links", () => {
  it("get https:// when typed without a scheme", () => {
    expect(normalizeUrl("example.edu/algo/lecture-07.pdf")).toEqual({
      ok: true,
      value: "https://example.edu/algo/lecture-07.pdf",
    });
    expect(normalizeUrl("example.edu:8080/x")).toEqual({
      ok: true,
      value: "https://example.edu:8080/x",
    });
  });

  it("keep an http or https link as typed", () => {
    expect(normalizeUrl(" http://example.edu/a?b=1 ")).toEqual({
      ok: true,
      value: "http://example.edu/a?b=1",
    });
  });

  it("are empty when nothing is typed", () => {
    expect(normalizeUrl("  ")).toEqual({ ok: true, value: null });
  });

  it("can never be anything but http or https, so a link can't run script", () => {
    for (const input of [
      "javascript:alert(1)",
      "data:text/html,hi",
      "ftp://example.edu/file",
      "https://exa mple.edu",
      "https://",
    ]) {
      expect(normalizeUrl(input), input).toEqual({ ok: false, error: "not-a-link" });
    }
  });

  it("are reported per field", () => {
    expect(checkItemText({ name: "Item", problemUrl: "ftp://x.edu", answerUrl: "x.edu" })).toEqual({
      ok: false,
      error: { problemUrl: "not-a-link" },
    });
  });
});

describe("Item images", () => {
  it("are named by their SHA-256 in hex and their type", () => {
    expect(isImageKey(key(1))).toBe(true);
    expect(isImageKey(key(1, "jpg"))).toBe(true);
    expect(isImageKey(key(1, "svg"))).toBe(false);
    expect(isImageKey("../secret.webp")).toBe(false);
  });

  it("are numbered from 1 on each side, in the order given", () => {
    const checked = checkItemImages([
      { key: key(1), side: "problem" },
      { key: key(2), side: "answer" },
      { key: key(3), side: "problem" },
    ]);
    expect(checked).toEqual({
      ok: true,
      value: [
        { key: key(1), side: "problem", position: 1 },
        { key: key(2), side: "answer", position: 1 },
        { key: key(3), side: "problem", position: 2 },
      ],
    });
  });

  it("may appear once per side, so the same picture can be on both sides", () => {
    expect(
      checkItemImages([
        { key: key(1), side: "problem" },
        { key: key(1), side: "answer" },
      ]).ok,
    ).toBe(true);
    expect(
      checkItemImages([
        { key: key(1), side: "problem" },
        { key: key(1), side: "problem" },
      ]),
    ).toEqual({ ok: false, error: "duplicate" });
  });

  it("are at most 10 per side", () => {
    const images = (side: string, count: number) =>
      Array.from({ length: count }, (_, i) => ({ key: key(i + 1), side }));
    expect(checkItemImages(images("problem", IMAGES_PER_SIDE)).ok).toBe(true);
    expect(checkItemImages(images("answer", IMAGES_PER_SIDE + 1))).toEqual({
      ok: false,
      error: "too-many",
    });
  });

  it("refuse anything that isn't a list of names and sides", () => {
    for (const input of [
      null,
      "x",
      [{ key: key(1), side: "middle" }],
      [{ key: "x", side: "problem" }],
    ]) {
      expect(checkItemImages(input)).toEqual({ ok: false, error: "invalid" });
    }
  });
});
