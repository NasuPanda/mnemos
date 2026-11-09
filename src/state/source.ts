import { setApi, type MnemosApi } from "@/lib/api";
import { resetDayStore } from "./day-store";
import { resetItemsStore } from "./items-store";
import { resetTodayStore } from "./today-store";

/**
 * Switches where the app's data comes from: the Worker, or the first-run tutorial's practice
 * copy. Every store forgets what it fetched, so nothing from one shows in the other, and
 * answers still on their way from the one before are dropped.
 */
export function switchApi(next: MnemosApi): void {
  setApi(next);
  resetTodayStore();
  resetDayStore();
  resetItemsStore();
}
