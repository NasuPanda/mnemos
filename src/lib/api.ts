import type { IsoDate } from "@/core";
import type {
  AddStopRequest,
  CreateItemRequest,
  CreateSectionRequest,
  DayResponse,
  DeleteItemResponse,
  DeleteSectionResponse,
  ItemHistoryResponse,
  ItemResponse,
  ItemsResponse,
  LadderResponse,
  MeResponse,
  RateRequest,
  RateResponse,
  ReorderSectionsRequest,
  SectionResponse,
  SectionsResponse,
  SetGapRequest,
  TodayResponse,
  UndoResponse,
  UpdateItemRequest,
  UpdateSectionRequest,
  UploadImageResponse,
} from "../../worker/contract";

/**
 * Everything the app asks the Worker, one method per route. The app calls these through `api()`
 * only, so the first-run tutorial can swap in a practice copy that never reaches the server.
 * Refusals throw an ApiError with the Worker's error code, from either one.
 */
export type MnemosApi = {
  me(): Promise<MeResponse>;
  today(date: IsoDate): Promise<TodayResponse>;
  day(date: IsoDate, today: IsoDate): Promise<DayResponse>;
  rate(request: RateRequest): Promise<RateResponse>;
  undo(reviewId: number, date: IsoDate): Promise<UndoResponse>;
  items(date: IsoDate): Promise<ItemsResponse>;
  item(itemId: number): Promise<ItemResponse>;
  itemHistory(itemId: number): Promise<ItemHistoryResponse>;
  createItem(request: CreateItemRequest): Promise<ItemResponse>;
  updateItem(itemId: number, request: UpdateItemRequest): Promise<ItemResponse>;
  deleteItem(itemId: number): Promise<DeleteItemResponse>;
  createSection(request: CreateSectionRequest): Promise<SectionResponse>;
  updateSection(sectionId: number, request: UpdateSectionRequest): Promise<SectionResponse>;
  reorderSections(request: ReorderSectionsRequest): Promise<SectionsResponse>;
  deleteSection(sectionId: number): Promise<DeleteSectionResponse>;
  setGap(stop: number, request: SetGapRequest): Promise<LadderResponse>;
  addStop(request: AddStopRequest): Promise<LadderResponse>;
  /** `ladder` is the ladder the person saw, so two windows can't remove a stop twice. */
  removeStop(stop: number, ladder: readonly number[]): Promise<LadderResponse>;
  uploadImage(key: string, blob: Blob): Promise<UploadImageResponse>;
  /** Where an image is shown from. */
  imageUrl(key: string): string;
};

export class ApiError extends Error {
  readonly status: number;
  /** The Worker's error code, such as "already-reviewed-today". */
  readonly code: string | undefined;
  /** The whole error answer, for refusals that say more than a code (the editor's fields). */
  readonly body: unknown;

  constructor(status: number, code?: string, body?: unknown) {
    super(`API request failed with ${status}${code ? ` (${code})` : ""}`);
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

const RELOAD_KEY = "mnemos:session-reload";
const RELOAD_GUARD_MS = 10_000;

/** GETs JSON from the Worker. */
const getJson = <T>(path: string) => request<T>("GET", path);

/** POSTs JSON to the Worker and returns its JSON answer. */
const postJson = <T>(path: string, body: unknown) => request<T>("POST", path, body);

/** PUTs JSON to the Worker and returns its JSON answer. */
const putJson = <T>(path: string, body: unknown) => request<T>("PUT", path, body);

/** PATCHes JSON on the Worker and returns its JSON answer. */
const patchJson = <T>(path: string, body: unknown) => request<T>("PATCH", path, body);

/** DELETEs on the Worker and returns its JSON answer. */
const del = <T>(path: string) => request<T>("DELETE", path);

/** PUTs a file, such as an image, to the Worker and returns its JSON answer. */
const putBlob = <T>(path: string, blob: Blob) =>
  send<T>("PUT", path, { body: blob, contentType: blob.type });

/**
 * When the Access session has expired (after a month), Access answers API calls with a redirect
 * to its login page. fetch can't follow that, so we reload the page and let Access show its
 * login. If we already reloaded a moment ago, we throw instead of reloading in a loop.
 */
function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  return send<T>(
    method,
    path,
    body === undefined ? {} : { body: JSON.stringify(body), contentType: "application/json" },
  );
}

async function send<T>(
  method: string,
  path: string,
  { body, contentType }: { body?: BodyInit; contentType?: string },
): Promise<T> {
  const res = await fetch(path, {
    method,
    redirect: "manual",
    headers: {
      Accept: "application/json",
      ...(contentType ? { "Content-Type": contentType } : {}),
    },
    body,
  });

  if (res.type === "opaqueredirect") {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (Date.now() - last > RELOAD_GUARD_MS) {
      sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
      window.location.reload();
      return new Promise<never>(() => {});
    }
    throw new ApiError(401);
  }
  if (!res.ok) {
    const error = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(res.status, error?.error, error);
  }
  return (await res.json()) as T;
}

/** The Worker's API over HTTP: the one the app uses outside the tutorial. */
export const httpApi: MnemosApi = {
  me: () => getJson("/api/me"),
  today: (date) => getJson(`/api/today?date=${date}`),
  day: (date, today) => getJson(`/api/days/${date}?today=${today}`),
  rate: (request) => postJson("/api/reviews", request),
  undo: (reviewId, date) => del(`/api/reviews/${reviewId}?date=${date}`),
  items: (date) => getJson(`/api/items?date=${date}`),
  item: (itemId) => getJson(`/api/items/${itemId}`),
  itemHistory: (itemId) => getJson(`/api/items/${itemId}/history`),
  createItem: (request) => postJson("/api/items", request),
  updateItem: (itemId, request) => putJson(`/api/items/${itemId}`, request),
  deleteItem: (itemId) => del(`/api/items/${itemId}`),
  createSection: (request) => postJson("/api/sections", request),
  updateSection: (sectionId, request) => patchJson(`/api/sections/${sectionId}`, request),
  reorderSections: (request) => putJson("/api/sections/order", request),
  deleteSection: (sectionId) => del(`/api/sections/${sectionId}`),
  setGap: (stop, request) => patchJson(`/api/ladder/stops/${stop}`, request),
  addStop: (request) => postJson("/api/ladder/stops", request),
  removeStop: (stop, ladder) => del(`/api/ladder/stops/${stop}?ladder=${ladder.join(",")}`),
  uploadImage: (key, blob) => putBlob(`/api/images/${key}`, blob),
  imageUrl: (key) => `/img/${key}`,
};

let current: MnemosApi = httpApi;

/** The API the app talks to now: the Worker's, or the tutorial's practice copy. */
export const api = (): MnemosApi => current;

/**
 * Swaps the API. Stores keep what they fetched, so use `switchApi` in src/state/source.ts,
 * which clears them too.
 */
export function setApi(next: MnemosApi): void {
  current = next;
}
