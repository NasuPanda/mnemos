import {
  addDays,
  addStop,
  assignLine,
  checkItemImages,
  checkItemText,
  compareDates,
  CONFIDENCES,
  gapIssue,
  IMAGES_PER_PERSON,
  isImageKey,
  isIsoDate,
  lowestStopMovedDown,
  rate,
  removeStop,
  setGap,
  undo,
  validateCode,
  validateSectionName,
  weekOf,
  type IsoDate,
  type Ladder,
} from "@/core";
import { ApiError, httpApi, type MnemosApi } from "@/lib/api";
import type {
  ImageDto,
  ItemDto,
  ItemFieldsRequest,
  ItemResponse,
  LadderErrorResponse,
  ReviewDto,
  SectionDto,
} from "../../worker/contract";
import type { SandboxState } from "./sandbox-state";

/** The practice copy, plus what the tutorial needs to keep it and to clean up after it. */
export type SandboxApi = MnemosApi & {
  /** A copy of the practice day as it is now, for sessionStorage. */
  snapshot(): SandboxState;
  /** Lets go of the images added in the practice editor. */
  dispose(): void;
};

const TEXT_FIELDS = [
  "name",
  "description",
  "problemUrl",
  "problemText",
  "answerUrl",
  "answerText",
  "sideNote",
] as const;

/** A refusal in the Worker's shape: its status, and a body with the error code. */
function refuse(status: number, error: string, more: object = {}): never {
  throw new ApiError(status, error, { error, ...more });
}

/** Answers are copies, so nothing outside can change the practice day by accident. */
const copy = <T>(value: T): T => structuredClone(value);

/**
 * The Worker's API, run in the browser on an in-memory practice day (design plan, First-run
 * tutorial). Every route follows the same src/core rules as the Worker, with the same order and
 * the same refusals; the contract suite (src/lib/api-contract.ts) checks both. Only `me` and
 * `completeTutorial` reach the Worker. `staticImages` maps the sample data's image names to
 * files under public/.
 */
export function createSandboxApi(
  initial: SandboxState,
  staticImages: Record<string, string> = {},
): SandboxApi {
  const state = copy(initial);
  /** Images added in the practice editor: their names and object URLs. Not saved on reload. */
  const uploads = new Map<string, string>();

  const item = (itemId: number) => state.items.find((i) => i.id === itemId);
  const section = (sectionId: number) => state.sections.find((s) => s.id === sectionId);
  const sectionsInOrder = () =>
    [...state.sections].sort((a, b) => a.position - b.position || a.id - b.id);
  const imagesOf = (itemId: number): ImageDto[] =>
    state.images
      .filter((image) => image.itemId === itemId)
      .sort(
        (a, b) =>
          (a.side === "problem" ? 0 : 1) - (b.side === "problem" ? 0 : 1) ||
          a.position - b.position,
      )
      .map(({ key, side, position }) => ({ key, side, position }));
  const withImages = (row: Omit<ItemDto, "images">): ItemDto => ({
    ...row,
    images: imagesOf(row.id),
  });
  const reviewedOn = (date: IsoDate) =>
    new Set(state.reviews.filter((r) => r.reviewedOn === date).map((r) => r.itemId));
  const itemResponse = (itemId: number): ItemResponse => {
    const found = item(itemId);
    if (!found) refuse(404, "not_found");
    return copy({
      item: withImages(found),
      reviews: state.reviews.filter((r) => r.itemId === itemId).length,
    });
  };

  /** Everything a save needs to be true, in the Worker's order (worker/routes/items.ts). */
  function checkSave(itemId: number | null, body: ItemFieldsRequest) {
    const text: Partial<Record<(typeof TEXT_FIELDS)[number], string | null>> = {};
    for (const field of TEXT_FIELDS) {
      const value: unknown = body[field];
      if (value !== undefined && value !== null && typeof value !== "string") {
        refuse(400, `${field} must be text`);
      }
      text[field] = value ?? null;
    }
    const fields = checkItemText(text);
    if (!fields.ok) refuse(422, "invalid-fields", { fields: fields.error });
    const images = checkItemImages(body.images ?? []);
    if (!images.ok) refuse(images.error === "invalid" ? 400 : 422, `images-${images.error}`);
    if (!section(body.sectionId)) refuse(422, "section-not-found");
    const keys = new Set(images.value.map((image) => image.key));
    if (keys.size > 0) {
      for (const image of state.images) if (image.itemId !== itemId) keys.add(image.key);
      if (keys.size > IMAGES_PER_PERSON) refuse(422, "images-limit");
    }
    return { fields: { ...fields.value, sectionId: body.sectionId }, images: images.value };
  }

  function putImages(itemId: number, images: ReturnType<typeof checkSave>["images"]) {
    state.images = state.images.filter((image) => image.itemId !== itemId);
    for (const image of images) state.images.push({ ...image, itemId });
  }

  /** The person's ladder is still the one the change started from (worker/routes/ladder.ts). */
  function checkSeen(seen: readonly number[]): Ladder {
    const current = state.settings.ladder;
    const same = current.length === seen.length && current.every((gap, i) => gap === seen[i]);
    if (!same) refuse(409, "ladder-changed", { ladder: [...current] });
    return current;
  }
  function ladderRefusal(body: LadderErrorResponse): never {
    const { error, ...more } = body;
    return refuse(422, error, more);
  }

  const api: SandboxApi = {
    // The flag is the person's own, so these two go to the Worker.
    me: () => httpApi.me(),
    completeTutorial: () => httpApi.completeTutorial(),

    async today(date) {
      const reviewed = reviewedOn(date);
      const tomorrow = addDays(date, 1);
      return copy({
        date,
        ladder: [...state.settings.ladder],
        sections: sectionsInOrder(),
        items: state.items
          .filter((i) => compareDates(i.dueOn, date) <= 0 && !reviewed.has(i.id))
          .map(withImages),
        reviewsToday: state.reviews.filter((r) => r.reviewedOn === date),
        tomorrow: {
          date: tomorrow,
          itemIds: state.items.filter((i) => i.dueOn === tomorrow).map((i) => i.id),
        },
        nextLine: state.settings.nextLine,
      });
    },

    async day(date, today) {
      if (!isIsoDate(date) || !isIsoDate(today))
        refuse(400, "the date and today must be YYYY-MM-DD");
      const days = weekOf(date);
      const inWeek = (d: IsoDate) =>
        compareDates(d, days[0] as IsoDate) >= 0 && compareDates(d, days[6] as IsoDate) <= 0;
      const week = {
        days,
        due: state.items
          .filter((i) => compareDates(i.dueOn, today) > 0 && inWeek(i.dueOn))
          .sort((a, b) => compareDates(a.dueOn, b.dueOn) || a.id - b.id)
          .map((i) => ({ id: i.id, dueOn: i.dueOn })),
        reviews: state.reviews
          .filter((r) => compareDates(r.reviewedOn, today) < 0 && inWeek(r.reviewedOn))
          .sort((a, b) => compareDates(a.reviewedOn, b.reviewedOn) || a.id - b.id)
          .map((r) => ({ itemId: r.itemId, reviewedOn: r.reviewedOn })),
      };
      const order = compareDates(date, today);
      return copy({
        date,
        today,
        week,
        items:
          order === 0
            ? []
            : state.items
                .filter((i) =>
                  order > 0
                    ? i.dueOn === date
                    : state.reviews.some((r) => r.itemId === i.id && r.reviewedOn === date),
                )
                .sort((a, b) => a.id - b.id)
                .map(withImages),
        reviews:
          order < 0
            ? state.reviews
                .filter((r) => r.reviewedOn === date)
                .flatMap((r) => {
                  const reviewed = item(r.itemId);
                  return reviewed
                    ? [{ ...r, name: reviewed.name, sectionId: reviewed.sectionId }]
                    : [];
                })
            : [],
      });
    },

    async rate({ itemId, date, confidence, pickedDate }) {
      if (!isIsoDate(date) || !CONFIDENCES.includes(confidence)) {
        refuse(400, "itemId, date and confidence are required");
      }
      const rated = item(itemId);
      if (!rated) refuse(404, "not_found");
      const result = rate({
        item: rated,
        ladder: state.settings.ladder,
        today: date,
        confidence,
        pickedDate,
        reviewedToday: reviewedOn(date).has(itemId),
      });
      if (!result.ok) refuse(result.error === "already-reviewed-today" ? 409 : 422, result.error);
      const review: ReviewDto = { id: ++state.lastId.review, itemId, ...result.value };
      state.reviews.push(review);
      rated.stop = review.stopAfter;
      rated.dueOn = review.nextDueOn;
      return copy({ review, item: { id: itemId, stop: rated.stop, dueOn: rated.dueOn } });
    },

    async undo(reviewId, date) {
      const review = state.reviews.find((r) => r.id === reviewId);
      if (!review) refuse(404, "not_found");
      const restored = undo(review, date);
      if (!restored.ok) refuse(409, restored.error);
      const reviewed = item(review.itemId);
      if (!reviewed || reviewed.stop !== review.stopAfter || reviewed.dueOn !== review.nextDueOn) {
        refuse(409, "item-changed");
      }
      state.reviews = state.reviews.filter((r) => r.id !== reviewId);
      reviewed.stop = restored.value.stop;
      reviewed.dueOn = restored.value.dueOn;
      return copy({ item: { id: reviewed.id, ...restored.value } });
    },

    async items(date) {
      const reviewed = reviewedOn(date);
      return copy({
        date,
        items: state.items.map((i) => ({
          id: i.id,
          sectionId: i.sectionId,
          name: i.name,
          description: i.description,
          problemText: i.problemText,
          sideNote: i.sideNote,
          stop: i.stop,
          dueOn: i.dueOn,
          reviewedToday: reviewed.has(i.id),
        })),
      });
    },

    async item(itemId) {
      return itemResponse(itemId);
    },

    async itemHistory(itemId) {
      const found = item(itemId);
      if (!found) refuse(404, "not_found");
      return copy({
        item: {
          id: found.id,
          sectionId: found.sectionId,
          name: found.name,
          stop: found.stop,
          dueOn: found.dueOn,
        },
        reviews: state.reviews
          .filter((r) => r.itemId === itemId)
          .sort((a, b) => compareDates(b.reviewedOn, a.reviewedOn)),
      });
    },

    async createItem(request) {
      if (!isIsoDate(request.date)) refuse(400, "date must be YYYY-MM-DD");
      const { fields, images } = checkSave(null, request);
      const id = ++state.lastId.item;
      state.items.push({ id, ...fields, stop: 1, dueOn: request.date });
      putImages(id, images);
      return itemResponse(id);
    },

    async updateItem(itemId, request) {
      const { fields, images } = checkSave(itemId, request);
      const saved = item(itemId);
      if (!saved) refuse(404, "not_found");
      Object.assign(saved, fields);
      putImages(itemId, images);
      return itemResponse(itemId);
    },

    async deleteItem(itemId) {
      if (!item(itemId)) refuse(404, "not_found");
      state.items = state.items.filter((i) => i.id !== itemId);
      state.images = state.images.filter((image) => image.itemId !== itemId);
      state.reviews = state.reviews.filter((r) => r.itemId !== itemId);
      return { id: itemId };
    },

    async createSection({ name, code }) {
      const checkedName = validateSectionName(name);
      if (!checkedName.ok) refuse(422, `name-${checkedName.error}`);
      const checkedCode = validateCode(
        code,
        state.sections.map((s) => s.code),
      );
      if (!checkedCode.ok) refuse(422, `code-${checkedCode.error}`);
      const { line, nextLine } = assignLine(state.settings.nextLine);
      const created: SectionDto = {
        id: ++state.lastId.section,
        name: checkedName.value,
        code: checkedCode.value,
        line,
        position: Math.max(0, ...state.sections.map((s) => s.position)) + 1,
      };
      state.sections.push(created);
      state.settings.nextLine = nextLine;
      return copy({ section: created, nextLine });
    },

    async updateSection(sectionId, { name, code }) {
      const changed = section(sectionId);
      if (!changed) refuse(404, "not_found");
      const change: { name?: string; code?: string } = {};
      if (name !== undefined) {
        const checked = validateSectionName(name);
        if (!checked.ok) refuse(422, `name-${checked.error}`);
        change.name = checked.value;
      }
      if (code !== undefined) {
        const others = state.sections.filter((s) => s.id !== sectionId).map((s) => s.code);
        const checked = validateCode(code, others);
        if (!checked.ok) refuse(422, `code-${checked.error}`);
        change.code = checked.value;
      }
      if (Object.keys(change).length === 0) refuse(400, "nothing to change");
      Object.assign(changed, change);
      return copy({ section: changed, nextLine: state.settings.nextLine });
    },

    async reorderSections({ ids }) {
      const own = new Set(state.sections.map((s) => s.id));
      const given = new Set(ids);
      if (given.size !== ids.length || given.size !== own.size || ids.some((id) => !own.has(id))) {
        refuse(422, "invalid-order");
      }
      ids.forEach((id, index) => {
        const placed = section(id);
        if (placed) placed.position = index + 1;
      });
      return copy({ sections: sectionsInOrder() });
    },

    async deleteSection(sectionId) {
      if (!section(sectionId)) refuse(404, "not_found");
      const gone = new Set(state.items.filter((i) => i.sectionId === sectionId).map((i) => i.id));
      state.items = state.items.filter((i) => !gone.has(i.id));
      state.images = state.images.filter((image) => !gone.has(image.itemId));
      state.reviews = state.reviews.filter((r) => !gone.has(r.itemId));
      state.sections = state.sections.filter((s) => s.id !== sectionId);
      return { deletedItems: gone.size };
    },

    async setGap(stop, { ladder: seen, gap }) {
      const current = checkSeen(seen);
      if (stop > current.length) refuse(404, "not_found");
      const issue = gapIssue(current, stop, gap);
      if (issue) ladderRefusal({ error: issue.kind, ladder: [...current], issue });
      state.settings.ladder = [...setGap(current, stop, gap)];
      return { ladder: [...state.settings.ladder] };
    },

    async addStop({ ladder: seen }) {
      const current = checkSeen(seen);
      const result = addStop(current);
      if (!result.ok) ladderRefusal({ error: result.error, ladder: [...current] });
      state.settings.ladder = [...result.value];
      return { ladder: [...state.settings.ladder] };
    },

    async removeStop(stop, seen) {
      const current = checkSeen(seen);
      if (stop > current.length) refuse(404, "not_found");
      const result = removeStop(current, stop);
      if (!result.ok) ladderRefusal({ error: result.error, ladder: [...current] });
      const lowest = lowestStopMovedDown(stop);
      for (const moved of state.items) if (moved.stop >= lowest) moved.stop -= 1;
      state.settings.ladder = [...result.value];
      return { ladder: [...state.settings.ladder] };
    },

    async uploadImage(key, blob) {
      if (!isImageKey(key)) refuse(404, "not_found");
      if (!uploads.has(key)) uploads.set(key, URL.createObjectURL(blob));
      return { key };
    },

    imageUrl(key) {
      return uploads.get(key) ?? staticImages[key] ?? "";
    },

    snapshot: () => copy(state),

    dispose() {
      for (const url of uploads.values()) URL.revokeObjectURL(url);
      uploads.clear();
    },
  };
  return api;
}
