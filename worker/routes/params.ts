/** A row id from the URL or a request body: a positive whole number, or null. */
export function parseId(value: unknown): number | null {
  const id = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return typeof id === "number" && Number.isSafeInteger(id) && id >= 1 ? id : null;
}

/** The request's JSON body as a plain object, or null when it is missing or isn't one. */
export async function jsonObject(req: { json: () => Promise<unknown> }) {
  const body = await req.json().catch(() => null);
  return typeof body === "object" && body !== null && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : null;
}

/** Whether a D1 error is a UNIQUE constraint refusing a duplicate. */
export function isUniqueViolation(error: unknown): boolean {
  return String(error).includes("UNIQUE");
}
