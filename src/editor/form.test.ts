import { describe, expect, it } from "vitest";
import type { ItemDto } from "../../worker/contract";
import { checkForm, emptyForm, formFromItem, isDirty, toRequest, type EditorImage } from "./form";

const key = (n: number) => `${n.toString(16).padStart(64, "0")}.webp`;

const item: ItemDto = {
  id: 7,
  sectionId: 2,
  name: "Why Dijkstra fails on negative edges",
  description: null,
  problemUrl: "https://example.edu/algo/lecture-07.pdf",
  problemText: "Run Dijkstra from S.",
  answerUrl: null,
  answerText: "A is never relaxed again.",
  sideNote: null,
  stop: 4,
  dueOn: "2026-09-21",
  images: [
    { key: key(1), side: "problem", position: 1 },
    { key: key(2), side: "answer", position: 1 },
  ],
};

describe("Item editor › the form", () => {
  it("starts from the item, with empty fields as empty text", () => {
    const form = formFromItem(item);
    expect(form).toMatchObject({ sectionId: 2, description: "", answerUrl: "" });
    expect(form.images.map((i) => [i.side, i.key, i.src, i.status])).toEqual([
      ["problem", key(1), `/img/${key(1)}`, "stored"],
      ["answer", key(2), `/img/${key(2)}`, "stored"],
    ]);
  });

  it("knows when something changed, images included", () => {
    const initial = formFromItem(item);
    expect(isDirty(initial, { ...initial })).toBe(false);
    expect(isDirty(initial, { ...initial, sideNote: "Tip" })).toBe(true);
    expect(isDirty(initial, { ...initial, images: initial.images.slice().reverse() })).toBe(true);
    expect(isDirty(initial, { ...initial, images: initial.images.slice(1) })).toBe(true);
  });

  it("needs a name and a section, and says so in plain sentences", () => {
    expect(checkForm(emptyForm(null))).toEqual({
      name: "Give the item a name.",
      sectionId: "Pick a section, or type a new name to create one.",
    });
    expect(checkForm({ ...emptyForm(1), name: "Heap", problemUrl: "ftp://x" })).toEqual({
      problemUrl: "Use a web link, like example.edu/notes.",
    });
  });

  it("saves only the images that are stored, each side in its order", () => {
    const uploading: EditorImage = {
      id: "new",
      side: "problem",
      key: null,
      src: "blob:x",
      status: "uploading",
    };
    const form = formFromItem(item);
    const request = toRequest({ ...form, sectionId: 2, images: [...form.images, uploading] });
    expect(request.images).toEqual([
      { key: key(1), side: "problem" },
      { key: key(2), side: "answer" },
    ]);
  });
});
