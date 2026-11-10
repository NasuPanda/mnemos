// One suite for every MnemosApi: the Worker's (worker/routes/contract.test.ts) and the
// tutorial's practice copy (src/tutorial/sandbox-api.test.ts). Both must answer the same, so
// the practice day behaves as the app does. Relative imports only: the Worker project loads it.
import { describe, expect, it } from "vitest";
import type { ItemFieldsRequest, SectionDto } from "../../worker/contract";
import type { MnemosApi } from "./api";

// The design draft's Thursday, and the days around it.
const THU = "2026-09-24";
const FRI = "2026-09-25";
const WED = "2026-09-23";
const LADDER = [1, 2, 3, 5, 7, 14, 28];

/** An image name in the shape the browser makes: a SHA-256 and an extension. */
const imageKey = (n: number) => `${n.toString(16).padStart(64, "0")}.webp`;

const fieldsIn = (sectionId: number, name: string): ItemFieldsRequest => ({
  sectionId,
  name,
  description: null,
  problemUrl: null,
  problemText: `What is ${name}?`,
  answerUrl: null,
  answerText: null,
  sideNote: null,
  images: [],
});

/** What a refused call threw: its status, the Worker's error code and the whole body. */
async function refusal(call: Promise<unknown>) {
  try {
    await call;
  } catch (error) {
    const { status, code, body } = error as { status: number; code?: string; body?: unknown };
    return { status, code, body };
  }
  throw new Error("expected the call to be refused");
}

/**
 * The API contract, on an account that starts empty. `newAccount` gives each test its own.
 * Dates are the browser's, passed in as the app passes them.
 */
export function describeApiContract(name: string, newAccount: () => Promise<MnemosApi>) {
  async function withSection(code = "GR", sectionName = "Graphs") {
    const api = await newAccount();
    const { section } = await api.createSection({ name: sectionName, code });
    return { api, section };
  }

  async function withItem(itemName = "Dijkstra", date = THU) {
    const { api, section } = await withSection();
    const { item } = await api.createItem({ ...fieldsIn(section.id, itemName), date });
    return { api, section, item };
  }

  describe(`${name}: the API contract`, () => {
    describe("an empty account", () => {
      it("has nothing today, the default ladder, and M2 as the next colour", async () => {
        const api = await newAccount();
        expect(await api.today(THU)).toEqual({
          date: THU,
          ladder: LADDER,
          sections: [],
          items: [],
          reviewsToday: [],
          tomorrow: { date: FRI, itemIds: [] },
          nextLine: "m2",
        });
        expect(await api.items(THU)).toEqual({ date: THU, items: [] });
      });
    });

    describe("sections", () => {
      it("take the colours in turn, M2 → M3 → M4 → M2, and go last in the order", async () => {
        const api = await newAccount();
        const made: SectionDto[] = [];
        for (const [sectionName, code] of [
          ["Graphs", "GR"],
          ["Operating systems", "OS"],
          ["Data structures", "DS"],
          ["Compilers", "COM"],
        ] as const) {
          made.push((await api.createSection({ name: sectionName, code })).section);
        }
        expect(made.map((s) => [s.line, s.position])).toEqual([
          ["m2", 1],
          ["m3", 2],
          ["m4", 3],
          ["m2", 4],
        ]);
        const today = await api.today(THU);
        expect(today.sections.map((s) => s.code)).toEqual(["GR", "OS", "DS", "COM"]);
        expect(today.nextLine).toBe("m3");
      });

      it("are refused with a name or code that doesn't fit", async () => {
        const { api } = await withSection("GR");
        expect(await refusal(api.createSection({ name: " ", code: "AB" }))).toMatchObject({
          status: 422,
          code: "name-required",
        });
        expect(await refusal(api.createSection({ name: "Graphs 2", code: "gr" }))).toMatchObject({
          status: 422,
          code: "code-taken",
        });
        expect(await refusal(api.createSection({ name: "Other", code: "A" }))).toMatchObject({
          status: 422,
          code: "code-length",
        });
        expect(await refusal(api.createSection({ name: "Other", code: "A-B" }))).toMatchObject({
          status: 422,
          code: "code-characters",
        });
      });

      it("can be renamed and get a new code, keeping their colour", async () => {
        const { api, section } = await withSection();
        const { section: changed } = await api.updateSection(section.id, {
          name: "Graph algorithms",
          code: "ga",
        });
        expect(changed).toEqual({ ...section, name: "Graph algorithms", code: "GA" });
        expect(await refusal(api.updateSection(section.id + 1000, { name: "X" }))).toMatchObject({
          status: 404,
          code: "not_found",
        });
      });

      it("are reordered only with every one of the person's sections, once", async () => {
        const { api, section: first } = await withSection("GR");
        const { section: second } = await api.createSection({ name: "Systems", code: "SY" });
        const { sections } = await api.reorderSections({ ids: [second.id, first.id] });
        expect(sections.map((s) => [s.code, s.position])).toEqual([
          ["SY", 1],
          ["GR", 2],
        ]);
        expect(await refusal(api.reorderSections({ ids: [first.id] }))).toMatchObject({
          status: 422,
          code: "invalid-order",
        });
      });

      it("are deleted with their items, saying how many went", async () => {
        const { api, section } = await withItem();
        await api.createItem({ ...fieldsIn(section.id, "Prim"), date: THU });
        expect(await api.deleteSection(section.id)).toEqual({ deletedItems: 2 });
        const today = await api.today(THU);
        expect(today.sections).toEqual([]);
        expect(today.items).toEqual([]);
        expect(await refusal(api.deleteSection(section.id))).toMatchObject({ status: 404 });
      });
    });

    describe("items", () => {
      it("start on stop 1, due the day they're added, with no reviews", async () => {
        const { api, item, section } = await withItem("Dijkstra", THU);
        expect(item).toMatchObject({
          sectionId: section.id,
          name: "Dijkstra",
          stop: 1,
          dueOn: THU,
        });
        expect(await api.item(item.id)).toEqual({ item, reviews: 0 });
        expect((await api.today(THU)).items).toEqual([item]);
      });

      it("keep their images in order, problem side first", async () => {
        const { api, section } = await withSection();
        const { item } = await api.createItem({
          ...fieldsIn(section.id, "Dijkstra"),
          images: [
            { key: imageKey(3), side: "answer" },
            { key: imageKey(1), side: "problem" },
            { key: imageKey(2), side: "problem" },
          ],
          date: THU,
        });
        expect(item.images).toEqual([
          { key: imageKey(1), side: "problem", position: 1 },
          { key: imageKey(2), side: "problem", position: 2 },
          { key: imageKey(3), side: "answer", position: 1 },
        ]);
      });

      it("are refused with fields, a section or images that don't fit", async () => {
        const { api, section } = await withSection();
        expect(
          await refusal(api.createItem({ ...fieldsIn(section.id, " "), date: THU })),
        ).toMatchObject({
          status: 422,
          code: "invalid-fields",
          body: { fields: { name: "required" } },
        });
        expect(
          await refusal(api.createItem({ ...fieldsIn(section.id + 1000, "X"), date: THU })),
        ).toMatchObject({ status: 422, code: "section-not-found" });
        const twice = [
          { key: imageKey(1), side: "problem" as const },
          { key: imageKey(1), side: "problem" as const },
        ];
        expect(
          await refusal(api.createItem({ ...fieldsIn(section.id, "X"), images: twice, date: THU })),
        ).toMatchObject({ status: 422, code: "images-duplicate" });
      });

      it("are listed oldest first, marked when reviewed on the day asked about", async () => {
        const { api, section, item: first } = await withItem("Dijkstra");
        const { item: second } = await api.createItem({
          ...fieldsIn(section.id, "Prim"),
          date: THU,
        });
        await api.rate({ itemId: second.id, date: THU, confidence: "neutral" });

        const { items } = await api.items(THU);
        expect(items.map((i) => [i.id, i.reviewedToday])).toEqual([
          [first.id, false],
          [second.id, true],
        ]);
        expect((await api.items(FRI)).items.every((i) => !i.reviewedToday)).toBe(true);
      });

      it("keep their stop and due date when edited", async () => {
        const { api, item, section } = await withItem();
        await api.rate({ itemId: item.id, date: THU, confidence: "confident" });
        const { item: edited } = await api.updateItem(item.id, {
          ...fieldsIn(section.id, "Dijkstra, again"),
          sideNote: "Negative edges.",
        });
        expect(edited).toMatchObject({ name: "Dijkstra, again", sideNote: "Negative edges." });
        expect([edited.stop, edited.dueOn]).toEqual([2, "2026-09-26"]);
      });

      it("go when deleted, and are then not found", async () => {
        const { api, item } = await withItem();
        expect(await api.deleteItem(item.id)).toEqual({ id: item.id });
        expect(await refusal(api.item(item.id))).toMatchObject({ status: 404, code: "not_found" });
        expect(await refusal(api.deleteItem(item.id))).toMatchObject({ status: 404 });
        expect(await refusal(api.itemHistory(item.id))).toMatchObject({ status: 404 });
      });
    });

    describe("rating and undo", () => {
      it("moves the item on the ladder and counts the review as done today", async () => {
        const { api, item } = await withItem();
        const { review, item: moved } = await api.rate({
          itemId: item.id,
          date: THU,
          confidence: "confident",
        });
        expect(review).toMatchObject({
          itemId: item.id,
          reviewedOn: THU,
          confidence: "confident",
          stopBefore: 1,
          stopAfter: 2,
          wasDueOn: THU,
          nextDueOn: "2026-09-26",
          manual: false,
        });
        expect(moved).toEqual({ id: item.id, stop: 2, dueOn: "2026-09-26" });

        const today = await api.today(THU);
        expect(today.items).toEqual([]);
        expect(today.reviewsToday).toEqual([review]);
        expect((await api.item(item.id)).reviews).toBe(1);
      });

      it("allows one review per item per day", async () => {
        const { api, item } = await withItem();
        await api.rate({ itemId: item.id, date: THU, confidence: "neutral" });
        expect(
          await refusal(api.rate({ itemId: item.id, date: THU, confidence: "neutral" })),
        ).toMatchObject({ status: 409, code: "already-reviewed-today" });
      });

      it("uses a picked date after today, and refuses one that isn't", async () => {
        const { api, item } = await withItem();
        expect(
          await refusal(
            api.rate({ itemId: item.id, date: THU, confidence: "neutral", pickedDate: THU }),
          ),
        ).toMatchObject({ status: 422, code: "picked-date-not-after-today" });
        const { review } = await api.rate({
          itemId: item.id,
          date: THU,
          confidence: "neutral",
          pickedDate: "2026-10-01",
        });
        expect([review.nextDueOn, review.manual, review.stopAfter]).toEqual([
          "2026-10-01",
          true,
          1,
        ]);
      });

      it("refuses an item that isn't the person's", async () => {
        const { api, item } = await withItem();
        expect(
          await refusal(api.rate({ itemId: item.id + 1000, date: THU, confidence: "neutral" })),
        ).toMatchObject({ status: 404, code: "not_found" });
      });

      it("undoes a review made today, putting the item back", async () => {
        const { api, item } = await withItem();
        const { review } = await api.rate({ itemId: item.id, date: THU, confidence: "confident" });
        expect(await api.undo(review.id, THU)).toEqual({
          item: { id: item.id, stop: 1, dueOn: THU },
        });
        const today = await api.today(THU);
        expect(today.items.map((i) => i.id)).toEqual([item.id]);
        expect(today.reviewsToday).toEqual([]);
      });

      it("doesn't undo a review from another day", async () => {
        const { api, item } = await withItem("Dijkstra", WED);
        const { review } = await api.rate({ itemId: item.id, date: WED, confidence: "neutral" });
        expect(await refusal(api.undo(review.id, THU))).toMatchObject({
          status: 409,
          code: "not-from-today",
        });
        expect(await refusal(api.undo(review.id + 1000, WED))).toMatchObject({ status: 404 });
      });
    });

    describe("other days and history", () => {
      it("lists a future day's items, and today's reviews of them on the week strip", async () => {
        const { api, item } = await withItem();
        const { item: early } = await api.createItem({
          ...fieldsIn(item.sectionId, "Prim"),
          date: THU,
        });
        // Dijkstra lands on Saturday 26th (stop 2); Prim is reviewed today and lands on Friday.
        await api.rate({ itemId: item.id, date: THU, confidence: "confident" });
        await api.rate({ itemId: early.id, date: THU, confidence: "neutral" });

        const saturday = await api.day("2026-09-26", THU);
        expect(saturday.items.map((i) => i.id)).toEqual([item.id]);
        expect(saturday.reviews).toEqual([]);
        expect(saturday.week.days).toEqual([
          "2026-09-21",
          "2026-09-22",
          WED,
          THU,
          FRI,
          "2026-09-26",
          "2026-09-27",
        ]);
        expect(saturday.week.due).toEqual([
          { id: early.id, dueOn: FRI },
          { id: item.id, dueOn: "2026-09-26" },
        ]);
        expect((await api.today(THU)).tomorrow).toEqual({ date: FRI, itemIds: [early.id] });
      });

      it("lists a past day's reviews with the item's name and section", async () => {
        const { api, item } = await withItem("Dijkstra", WED);
        const { review } = await api.rate({ itemId: item.id, date: WED, confidence: "neutral" });

        const wednesday = await api.day(WED, THU);
        expect(wednesday.items).toEqual([]);
        expect(wednesday.reviews).toEqual([
          { ...review, name: "Dijkstra", sectionId: item.sectionId },
        ]);
        expect(wednesday.week.reviews).toEqual([{ itemId: item.id, reviewedOn: WED }]);
      });

      it("shows an item's reviews newest first", async () => {
        const { api, item } = await withItem("Dijkstra", WED);
        const first = await api.rate({ itemId: item.id, date: WED, confidence: "not_at_all" });
        const second = await api.rate({ itemId: item.id, date: THU, confidence: "confident" });

        const history = await api.itemHistory(item.id);
        expect(history.item).toEqual({
          id: item.id,
          sectionId: item.sectionId,
          name: "Dijkstra",
          stop: 2,
          dueOn: "2026-09-26",
        });
        expect(history.reviews).toEqual([second.review, first.review]);
      });
    });

    describe("the ladder", () => {
      it("takes a new gap that fits between its neighbours", async () => {
        const api = await newAccount();
        expect(await api.setGap(4, { ladder: LADDER, gap: 6 })).toEqual({
          ladder: [1, 2, 3, 6, 7, 14, 28],
        });
        expect((await api.today(THU)).ladder).toEqual([1, 2, 3, 6, 7, 14, 28]);
      });

      it("refuses a gap that doesn't fit, saying why", async () => {
        const api = await newAccount();
        expect(await refusal(api.setGap(4, { ladder: LADDER, gap: 3 }))).toMatchObject({
          status: 422,
          code: "gap-not-longer",
          body: {
            ladder: LADDER,
            issue: { kind: "gap-not-longer", previous: { stop: 3, gap: 3 } },
          },
        });
        expect(await refusal(api.setGap(4, { ladder: LADDER, gap: 400 }))).toMatchObject({
          status: 422,
          code: "gap-out-of-range",
        });
      });

      it("refuses a change made from an older ladder, sending the one there is now", async () => {
        const api = await newAccount();
        await api.setGap(4, { ladder: LADDER, gap: 6 });
        expect(await refusal(api.setGap(4, { ladder: LADDER, gap: 5 }))).toMatchObject({
          status: 409,
          code: "ladder-changed",
          body: { ladder: [1, 2, 3, 6, 7, 14, 28] },
        });
        expect(await refusal(api.addStop({ ladder: LADDER }))).toMatchObject({
          status: 409,
          code: "ladder-changed",
        });
      });

      it("adds a stop at double the last gap, until it has seven", async () => {
        const api = await newAccount();
        await api.removeStop(7, LADDER);
        expect(await api.addStop({ ladder: [1, 2, 3, 5, 7, 14] })).toEqual({
          ladder: [1, 2, 3, 5, 7, 14, 28],
        });
        expect(await refusal(api.addStop({ ladder: LADDER }))).toMatchObject({
          status: 422,
          code: "max-stops",
        });
      });

      it("removes a stop, moving its items down one stop", async () => {
        const { api, item } = await withItem();
        await api.rate({ itemId: item.id, date: THU, confidence: "confident" });
        expect(await api.removeStop(2, LADDER)).toEqual({ ladder: [1, 3, 5, 7, 14, 28] });
        expect((await api.item(item.id)).item).toMatchObject({ stop: 1, dueOn: "2026-09-26" });
        expect(await refusal(api.removeStop(9, [1, 3, 5, 7, 14, 28]))).toMatchObject({
          status: 404,
        });
      });
    });
  });
}
