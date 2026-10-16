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
export const getJson = <T>(path: string) => request<T>("GET", path);

/** POSTs JSON to the Worker and returns its JSON answer. */
export const postJson = <T>(path: string, body: unknown) => request<T>("POST", path, body);

/** PUTs JSON to the Worker and returns its JSON answer. */
export const putJson = <T>(path: string, body: unknown) => request<T>("PUT", path, body);

/** PATCHes JSON on the Worker and returns its JSON answer. */
export const patchJson = <T>(path: string, body: unknown) => request<T>("PATCH", path, body);

/** DELETEs on the Worker and returns its JSON answer. */
export const del = <T>(path: string) => request<T>("DELETE", path);

/**
 * When the Access session has expired (after a month), Access answers API calls with a redirect
 * to its login page. fetch can't follow that, so we reload the page and let Access show its
 * login. If we already reloaded a moment ago, we throw instead of reloading in a loop.
 */
async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    redirect: "manual",
    headers: {
      Accept: "application/json",
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
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
