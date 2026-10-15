// The API's request and response shapes, shared by the Worker and the app.
// Types only, importing only from src/core, so the app can import this file safely.
import type { Confidence, IsoDate, Line } from "../src/core";

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
