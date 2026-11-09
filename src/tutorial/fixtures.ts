import { addDays, rate, type Confidence, type IsoDate } from "@/core";
import type { ItemFieldsRequest, ReviewDto } from "../../worker/contract";
import { emptySandbox, type SandboxState } from "./sandbox-state";

// The practice day of the first-run tutorial: the design plan's sample data (First-run tutorial,
// "Sample data"). Dates count from the day the tutorial starts.

/** The Binary search item's problem image: a name in the image shape, served as a static file. */
export const SORTED_ARRAY_KEY =
  "5a6f72746564206172726179206f6620312c303030206974656d73206d6e656d.webp";

/** The sample data's images, by name: files under public/ (the stand-in until issue #31). */
export const SAMPLE_IMAGES: Record<string, string> = {
  [SORTED_ARRAY_KEY]: "/tutorial/sorted-array.webp",
};

const BINARY_SEARCH_ANSWER = [
  "10, since 2¹⁰ = 1,024: each step halves what's left, so O(log n).",
  "",
  "```python",
  "def search(items, value):",
  "    lo, hi = 0, len(items) - 1",
  "    while lo <= hi:",
  "        mid = (lo + hi) // 2",
  "        if items[mid] == value:",
  "            return mid",
  "        if items[mid] < value:",
  "            lo = mid + 1",
  "        else:",
  "            hi = mid - 1",
  "    return -1",
  "```",
].join("\n");

/** The line the prefilled new item goes in. */
export const PRACTICE_LINE = "HU";

/** The new item the editor opens with, filled in (step 4 onwards); its line is PRACTICE_LINE. */
export const PRACTICE_ITEM: Omit<ItemFieldsRequest, "sectionId"> = {
  name: "Egészségedre!",
  description: null,
  problemUrl: null,
  problemText: "What do you say when someone sneezes, or when you raise a glass?",
  answerUrl: null,
  answerText: "Egészségedre! (to your health). To a group: Egészségetekre!",
  sideNote: null,
  images: [],
};

type SampleItem = {
  section: "HU" | "AL";
  name: string;
  description?: string;
  problemText: string;
  answerText: string;
  sideNote?: string;
  /** Confident reviews, as days before today; the item starts on stop 1, due on the first. */
  reviews: number[];
  images?: string[];
};

const ITEMS: SampleItem[] = [
  {
    section: "HU",
    name: "villamos",
    description: "Getting around Budapest.",
    problemText: "What is the Hungarian word for tram?",
    answerText: "Plural: villamosok. Budapest's trams are bright yellow.",
    sideNote: 'villám means lightning: villamos first meant "electric".',
    // Stops 1 → 2 → 3 → 4, which leaves it due 2 days ago: "+2 days".
    reviews: [12, 10, 7],
  },
  {
    section: "HU",
    name: "köszönöm",
    problemText: 'How do you say "thank you" in Hungarian?',
    answerText: 'köszönöm. "Köszi" is the casual form.',
    // Stop 1 → 2, due today.
    reviews: [2],
  },
  {
    section: "AL",
    name: "Binary search on 1,000 items",
    problemText:
      "At most how many steps does binary search take to find a value among 1,000 sorted items?",
    answerText: BINARY_SEARCH_ANSWER,
    // Stops 1 → 2 → 3, due today.
    reviews: [5, 3],
    images: [SORTED_ARRAY_KEY],
  },
];

/**
 * The practice day for `today`: HU · Hungarian words (M2) and AL · Algorithms (M3), three items
 * with their histories, and the default ladder. The run is villamos (late), köszönöm, then
 * Binary search; the person's new item joins it.
 */
export function makeSandbox(today: IsoDate): SandboxState {
  const state = emptySandbox();
  state.sections = [
    { id: 1, name: "Hungarian words", code: "HU", line: "m2", position: 1 },
    { id: 2, name: "Algorithms", code: "AL", line: "m3", position: 2 },
  ];
  state.settings.nextLine = "m4";
  state.lastId.section = 2;

  const reviews: ReviewDto[] = [];
  ITEMS.forEach((sample, index) => {
    const id = index + 1;
    const sectionId = sample.section === "HU" ? 1 : 2;
    let stop = 1;
    let dueOn = addDays(today, -(sample.reviews[0] ?? 0));
    for (const daysAgo of sample.reviews) {
      const reviewedOn = addDays(today, -daysAgo);
      const confidence: Confidence = "confident";
      const result = rate({
        item: { stop, dueOn },
        ladder: state.settings.ladder,
        today: reviewedOn,
        confidence,
        reviewedToday: false,
      });
      if (!result.ok) throw new Error(`sample review refused: ${result.error}`);
      reviews.push({ id: 0, itemId: id, ...result.value });
      stop = result.value.stopAfter;
      dueOn = result.value.nextDueOn;
    }
    state.items.push({
      id,
      sectionId,
      name: sample.name,
      description: sample.description ?? null,
      problemUrl: null,
      problemText: sample.problemText,
      answerUrl: null,
      answerText: sample.answerText,
      sideNote: sample.sideNote ?? null,
      stop,
      dueOn,
    });
    (sample.images ?? []).forEach((key, position) =>
      state.images.push({ itemId: id, key, side: "problem", position: position + 1 }),
    );
  });
  state.lastId.item = ITEMS.length;

  // Review ids follow the order the reviews were made, oldest first.
  reviews.sort((a, b) => (a.reviewedOn < b.reviewedOn ? -1 : a.reviewedOn > b.reviewedOn ? 1 : 0));
  state.reviews = reviews.map((review, index) => ({ ...review, id: index + 1 }));
  state.lastId.review = reviews.length;
  return state;
}
