import { describe, expect, it, vi } from "vitest";
import { httpApi, type MnemosApi } from "@/lib/api";
import type { DayResponse, ItemDto, TodayResponse } from "../../worker/contract";
import { retryDay } from "./day-store";
import { loadItems, refreshItems } from "./items-store";
import { switchApi } from "./source";
import { load, rateItem, refreshToday } from "./today-store";

const TODAY = "2026-11-09";

const item: ItemDto = {
  id: 1,
  sectionId: 1,
  name: "villamos",
  description: null,
  problemUrl: null,
  problemText: "What is the Hungarian word for tram?",
  answerUrl: null,
  answerText: null,
  sideNote: null,
  stop: 1,
  dueOn: TODAY,
  images: [],
};

const todayWith = (ladder: number[]): TodayResponse => ({
  date: TODAY,
  ladder,
  sections: [],
  items: [item],
  reviewsToday: [],
  tomorrow: { date: "2026-11-10", itemIds: [] },
  nextLine: "m2",
});

const day: DayResponse = {
  date: "2026-11-12",
  today: TODAY,
  week: { days: [], due: [], reviews: [] },
  items: [],
  reviews: [],
};

/** An API that answers today, a day and the Items list, and records what it was asked. */
function fakeApi(today: () => Promise<TodayResponse> = () => Promise.resolve(todayWith([1, 2]))) {
  return {
    ...httpApi,
    today: vi.fn(today),
    day: vi.fn(() => Promise.resolve(day)),
    items: vi.fn(() => Promise.resolve({ date: TODAY, items: [] })),
    rate: vi.fn(() => new Promise<never>(() => {})),
  } satisfies MnemosApi;
}

/** How far a Confident rating of the stop-1 item moves it: stop 2's gap in the loaded ladder. */
function confidentDueOn() {
  const rating = rateItem(item, "confident");
  return rating.ok ? rating.value.review.nextDueOn : rating.error;
}

describe("switchApi", () => {
  it("makes today load from the new API, and not refresh what the old one loaded", async () => {
    const before = fakeApi();
    const after = fakeApi();
    switchApi(before);
    await load(TODAY);

    switchApi(after);
    await refreshToday();
    expect(after.today).not.toHaveBeenCalled();

    await load(TODAY);
    expect(after.today).toHaveBeenCalledTimes(1);
    expect(before.today).toHaveBeenCalledTimes(1);
  });

  it("drops today's answer from the old API when it arrives after the switch", async () => {
    let answer: (data: TodayResponse) => void = () => {};
    const before = fakeApi(() => new Promise((resolve) => (answer = resolve)));
    const after = fakeApi(() => Promise.resolve(todayWith([1, 2])));
    switchApi(before);
    const late = load(TODAY);

    switchApi(after);
    await load(TODAY);
    answer(todayWith([1, 30]));
    await late;

    // The new API's ladder is the one in use: stop 2 is 2 days away, not 30.
    expect(confidentDueOn()).toBe("2026-11-11");
  });

  it("makes the Items list load from the new API", async () => {
    const before = fakeApi();
    const after = fakeApi();
    switchApi(before);
    await loadItems(TODAY);

    switchApi(after);
    await refreshItems();
    expect(after.items).not.toHaveBeenCalled();

    await loadItems(TODAY);
    expect(after.items).toHaveBeenCalledTimes(1);
  });

  it("forgets the days fetched, so they come from the new API", async () => {
    const before = fakeApi();
    const after = fakeApi();
    switchApi(before);
    await retryDay("2026-11-12", TODAY);
    await retryDay("2026-11-12", TODAY);
    expect(before.day).toHaveBeenCalledTimes(1);

    switchApi(after);
    await retryDay("2026-11-12", TODAY);
    expect(after.day).toHaveBeenCalledTimes(1);
  });

  it("drops a day's answer from the old API when it arrives after the switch", async () => {
    let answer: (data: DayResponse) => void = () => {};
    const before = fakeApi();
    before.day.mockImplementation(() => new Promise((resolve) => (answer = resolve)));
    const after = fakeApi();
    switchApi(before);
    const late = retryDay("2026-11-12", TODAY);

    switchApi(after);
    answer(day);
    await late;

    // Had the old answer landed, the day would count as fetched and not be asked for again.
    await retryDay("2026-11-12", TODAY);
    expect(after.day).toHaveBeenCalledTimes(1);
  });
});
