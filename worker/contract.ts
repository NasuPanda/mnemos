// The API's request and response shapes, shared by the Worker and the app.
// Types only, importing only from src/core, so the app can import this file safely.
import type { Confidence, IsoDate, ItemTextProblems, Line } from "../src/core";

export type ApiError = { error: string };

export type SectionDto = {
  id: number;
  name: string;
  code: string;
  line: Line;
  position: number;
};

export type ImageDto = {
  /** The image's name in R2, served at /img/<key>. */
  key: string;
  side: "problem" | "answer";
  position: number;
};

/** An item with everything review mode shows, so a review run never waits on the network. */
export type ItemDto = {
  id: number;
  sectionId: number;
  name: string;
  description: string | null;
  problemUrl: string | null;
  problemText: string | null;
  answerUrl: string | null;
  answerText: string | null;
  sideNote: string | null;
  stop: number;
  dueOn: IsoDate;
  /** Problem images first, then answer images, each in position order. */
  images: ImageDto[];
};

export type ReviewDto = {
  id: number;
  itemId: number;
  reviewedOn: IsoDate;
  confidence: Confidence;
  stopBefore: number;
  stopAfter: number;
  wasDueOn: IsoDate;
  nextDueOn: IsoDate;
  manual: boolean;
};

/** GET /api/today?date=YYYY-MM-DD */
export type TodayResponse = {
  date: IsoDate;
  ladder: number[];
  /** In the person's section order. */
  sections: SectionDto[];
  /** Left today: due today or earlier and not reviewed today. */
  items: ItemDto[];
  /** Reviews made today, early ones included (Done). */
  reviewsToday: ReviewDto[];
  /** Items due tomorrow, for All done's "Tomorrow: 17 due, 5 of them already reviewed today". */
  tomorrow: { date: IsoDate; itemIds: number[] };
  /** The colour the next new section gets. */
  nextLine: Line;
};

/** POST /api/reviews */
export type RateRequest = {
  itemId: number;
  /** The browser's local date: today. */
  date: IsoDate;
  confidence: Confidence;
  /** A date after today, instead of the ladder's gap. */
  pickedDate?: IsoDate;
};

export type RateResponse = {
  review: ReviewDto;
  item: { id: number; stop: number; dueOn: IsoDate };
};

/** DELETE /api/reviews/:id?date=YYYY-MM-DD */
export type UndoResponse = {
  item: { id: number; stop: number; dueOn: IsoDate };
};

/**
 * Why a section's name or code was refused; the app explains each in one plain sentence.
 * "code-taken" is also the answer when two requests race for the same code.
 */
export type SectionProblem =
  "name-required" | "name-too-long" | "code-characters" | "code-length" | "code-taken";

/** POST /api/sections: the code is the suggestion the app showed, or one the person typed. */
export type CreateSectionRequest = { name: string; code: string };

/** PATCH /api/sections/:id: rename, change the code, or both. The colour never changes. */
export type UpdateSectionRequest = { name?: string; code?: string };

/** POST and PATCH /api/sections. */
export type SectionResponse = { section: SectionDto; nextLine: Line };

/** PUT /api/sections/order: every one of the person's section ids, in the new order. */
export type ReorderSectionsRequest = { ids: number[] };

export type SectionsResponse = { sections: SectionDto[] };

/** DELETE /api/sections/:id: the section goes, and its items and their reviews with it. */
export type DeleteSectionResponse = { deletedItems: number };

/** One row of the Items list: what it shows, and the text search looks through. */
export type ItemSummaryDto = {
  id: number;
  sectionId: number;
  name: string;
  description: string | null;
  problemText: string | null;
  sideNote: string | null;
  stop: number;
  dueOn: IsoDate;
  /** Reviewed on the request's date. */
  reviewedToday: boolean;
};

/** GET /api/items?date=YYYY-MM-DD: every item of the person's, oldest first. */
export type ItemsResponse = { date: IsoDate; items: ItemSummaryDto[] };

/** GET /api/items/:id: one item for the editor, and how many reviews deleting it would take. */
export type ItemResponse = { item: ItemDto; reviews: number };

/**
 * What the item editor saves. Empty fields may be "" or null; each side's images are listed in
 * order. The stop and due date are never part of it.
 */
export type ItemFieldsRequest = {
  sectionId: number;
  name: string;
  description: string | null;
  problemUrl: string | null;
  problemText: string | null;
  answerUrl: string | null;
  answerText: string | null;
  sideNote: string | null;
  images: { key: string; side: ImageDto["side"] }[];
};

/** POST /api/items: a new item starts on stop 1, due `date`, the browser's today. */
export type CreateItemRequest = ItemFieldsRequest & { date: IsoDate };

/** PUT /api/items/:id: every field again. */
export type UpdateItemRequest = ItemFieldsRequest;

/** A refused save: per-field problems, or one about the images or the section. */
export type ItemErrorResponse = {
  error: "invalid-fields" | "section-not-found" | ItemImagesError;
  fields?: ItemTextProblems;
};
export type ItemImagesError =
  "images-invalid" | "images-duplicate" | "images-too-many" | "images-limit";

/** DELETE /api/items/:id */
export type DeleteItemResponse = { id: number };

/** PUT /api/images/:key: 201 when stored, 200 when it already was. */
export type UploadImageResponse = { key: string };
