import type { IsoDate } from "@/core";
import { del, getJson, postJson, putJson } from "@/lib/api";
import type {
  DeleteItemResponse,
  ItemDto,
  ItemFieldsRequest,
  ItemResponse,
} from "../../worker/contract";
import { forgetDayItem, refreshDays } from "./day-store";
import { dropItems, putItem } from "./items-store";
import { forgetTodayItem, putTodayItem, refreshToday } from "./today-store";

export const loadItem = (itemId: number) => getJson<ItemResponse>(`/api/items/${itemId}`);

/**
 * Saves an item, new or edited, and shows it everywhere at once: in the Items list and on
 * today's dashboard, which is then fetched again to be sure, as are other days when next shown.
 * Refusals throw an ApiError.
 */
export async function saveItem(
  itemId: number | null,
  fields: ItemFieldsRequest,
  date: IsoDate,
): Promise<ItemDto> {
  const { item } =
    itemId === null
      ? await postJson<ItemResponse>("/api/items", { ...fields, date })
      : await putJson<ItemResponse>(`/api/items/${itemId}`, fields);
  putItem({
    id: item.id,
    sectionId: item.sectionId,
    name: item.name,
    description: item.description,
    problemText: item.problemText,
    sideNote: item.sideNote,
    stop: item.stop,
    dueOn: item.dueOn,
  });
  putTodayItem(item);
  void refreshToday();
  refreshDays();
  return item;
}

export async function deleteItem(itemId: number): Promise<void> {
  await del<DeleteItemResponse>(`/api/items/${itemId}`);
  dropItems((item) => item.id !== itemId);
  forgetTodayItem(itemId);
  forgetDayItem(itemId);
  void refreshToday();
}

const LAST_SECTION = "mnemos:last-section";

/** The line the person last saved an item in, so the next new item starts there. */
export function lastSection(): number | null {
  try {
    const id = Number(localStorage.getItem(LAST_SECTION));
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

export function rememberSection(sectionId: number): void {
  try {
    localStorage.setItem(LAST_SECTION, String(sectionId));
  } catch {
    // A private window without storage: the next new item just starts without a line.
  }
}
