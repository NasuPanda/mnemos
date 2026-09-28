export class ApiError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`API request failed with ${status}`);
    this.status = status;
  }
}

const RELOAD_KEY = "mnemos:session-reload";
const RELOAD_GUARD_MS = 10_000;

/**
 * GETs JSON from the Worker.
 *
 * When the Access session has expired (after a month), Access answers API calls with a redirect to
 * its login page. fetch can't follow that, so we reload the page and let Access show its login.
 * If we already reloaded a moment ago, we throw instead of reloading in a loop.
 */
export async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path, { redirect: "manual", headers: { Accept: "application/json" } });

  if (res.type === "opaqueredirect") {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (Date.now() - last > RELOAD_GUARD_MS) {
      sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
      window.location.reload();
      return new Promise<never>(() => {});
    }
    throw new ApiError(401);
  }
  if (!res.ok) throw new ApiError(res.status);
  return (await res.json()) as T;
}
