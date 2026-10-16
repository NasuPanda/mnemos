import { describe, expect, it } from "vitest";
import type { EditorImage, ImageSide } from "./form";
import { hasKey, moveImage, roomFor, sideImages } from "./images";

const image = (id: string, side: ImageSide, key: string | null = null): EditorImage => ({
  id,
  side,
  key,
  src: `blob:${id}`,
  status: "stored",
});

const images = [
  image("p1", "problem"),
  image("p2", "problem"),
  image("p3", "problem"),
  image("a1", "answer"),
];
const ids = (list: EditorImage[]) => list.map((i) => i.id);

describe("Item editor › reordering images", () => {
  it("moves an image within its side", () => {
    expect(ids(moveImage(images, "p3", 0))).toEqual(["p3", "p1", "p2", "a1"]);
    expect(ids(moveImage(images, "p1", 2))).toEqual(["p2", "p3", "p1", "a1"]);
  });

  it("stops at either end of the side", () => {
    expect(ids(moveImage(images, "p1", -1))).toEqual(["p1", "p2", "p3", "a1"]);
    expect(ids(moveImage(images, "p3", 9))).toEqual(["p1", "p2", "p3", "a1"]);
  });

  it("never moves an image to the other side", () => {
    const moved = moveImage(images, "a1", 0);
    expect(ids(sideImages(moved, "answer"))).toEqual(["a1"]);
    expect(ids(sideImages(moved, "problem"))).toEqual(["p1", "p2", "p3"]);
  });
});

describe("Item editor › adding images", () => {
  it("fits at most 10 images on a side", () => {
    expect(roomFor(images, "problem", 5)).toBe(5);
    expect(roomFor(images, "problem", 9)).toBe(7);
    const full = Array.from({ length: 10 }, (_, i) => image(`x${i}`, "answer"));
    expect(roomFor(full, "answer", 1)).toBe(0);
  });

  it("notices the same picture twice on a side, but not on the other side", () => {
    const list = [image("p1", "problem", "k.webp"), image("new", "problem", "k.webp")];
    expect(hasKey(list, "problem", "k.webp", "new")).toBe(true);
    expect(hasKey(list, "answer", "k.webp", "new")).toBe(false);
  });
});
