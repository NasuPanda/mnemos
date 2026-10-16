import { ok, refuse, type Result } from "./result";

/** Longest text each field takes. Names and descriptions are short; Markdown fields are not. */
export const ITEM_LIMITS = {
  name: 300,
  description: 1_000,
  markdown: 20_000,
  url: 2_048,
} as const;

/** Images per side of one item, and per person across all their items. */
export const IMAGES_PER_SIDE = 10;
export const IMAGES_PER_PERSON = 2_000;
/** The largest image the Worker stores: the file after the browser has shrunk it. */
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

/** The text fields a person writes on an item. */
export type ItemText = {
  name: string;
  description: string | null;
  problemUrl: string | null;
  problemText: string | null;
  answerUrl: string | null;
  answerText: string | null;
  sideNote: string | null;
};

export type ItemTextField = keyof ItemText;
export type ItemFieldProblem = "required" | "too-long" | "not-a-link";
export type ItemTextProblems = Partial<Record<ItemTextField, ItemFieldProblem>>;

const MARKDOWN_FIELDS = ["problemText", "answerText", "sideNote"] as const;
const URL_FIELDS = ["problemUrl", "answerUrl"] as const;

/**
 * Checks and tidies what the person typed:
 *
 * - Name is required; it and Description lose surrounding spaces.
 * - Markdown fields keep their text but lose trailing spaces and blank lines.
 * - Links without a scheme get https:// ("example.edu/x" → "https://example.edu/x"); only http
 *   and https links are allowed.
 * - Empty fields are stored as null.
 */
export function checkItemText(input: {
  [K in ItemTextField]?: string | null;
}): Result<ItemText, ItemTextProblems> {
  const problems: ItemTextProblems = {};

  const name = (input.name ?? "").trim();
  if (name === "") problems.name = "required";
  else if (name.length > ITEM_LIMITS.name) problems.name = "too-long";

  const description = emptyToNull((input.description ?? "").trim());
  if (description && description.length > ITEM_LIMITS.description) {
    problems.description = "too-long";
  }

  const text: Pick<ItemText, (typeof MARKDOWN_FIELDS)[number]> = {
    problemText: null,
    answerText: null,
    sideNote: null,
  };
  for (const field of MARKDOWN_FIELDS) {
    const value = emptyToNull((input[field] ?? "").replace(/^(?:[ \t]*\n)+/, "").trimEnd());
    if (value && value.length > ITEM_LIMITS.markdown) problems[field] = "too-long";
    text[field] = value;
  }

  const urls: Pick<ItemText, (typeof URL_FIELDS)[number]> = { problemUrl: null, answerUrl: null };
  for (const field of URL_FIELDS) {
    const checked = normalizeUrl(input[field] ?? "");
    if (checked.ok) urls[field] = checked.value;
    else problems[field] = checked.error;
  }

  if (Object.keys(problems).length > 0) return refuse(problems);
  return ok({ name, description, ...urls, ...text });
}

/**
 * A link as stored: trimmed, with https:// added when no scheme was typed. Empty is null.
 * Anything but an http or https link is refused, so a link can never run script.
 */
export function normalizeUrl(input: string): Result<string | null, "too-long" | "not-a-link"> {
  const trimmed = input.trim();
  if (trimmed === "") return ok(null);
  // Only "scheme://" counts as a scheme, so "example.edu:8080/x" still gets https://.
  const withScheme = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  if (withScheme.length > ITEM_LIMITS.url) return refuse("too-long");
  if (/\s/.test(withScheme)) return refuse("not-a-link");
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return refuse("not-a-link");
  }
  if ((url.protocol !== "http:" && url.protocol !== "https:") || url.hostname === "") {
    return refuse("not-a-link");
  }
  return ok(withScheme);
}

/** A stored image's name: the SHA-256 of its content in hex, then its type. */
const IMAGE_KEY = /^[0-9a-f]{64}\.(webp|jpg|png)$/;

export function isImageKey(value: unknown): value is string {
  return typeof value === "string" && IMAGE_KEY.test(value);
}

export type ImageSide = "problem" | "answer";
export type ItemImageInput = { key: string; side: ImageSide };
export type ItemImagesProblem = "invalid" | "duplicate" | "too-many";

/**
 * Checks an item's image list, each side in its own order: valid names, each image at most once
 * per side, and at most 10 per side. Returns the rows to store, positions counted per side from 1.
 */
export function checkItemImages(
  input: unknown,
): Result<(ItemImageInput & { position: number })[], ItemImagesProblem> {
  if (!Array.isArray(input)) return refuse("invalid");
  const seen = { problem: new Set<string>(), answer: new Set<string>() };
  const rows: (ItemImageInput & { position: number })[] = [];
  for (const image of input as unknown[]) {
    if (typeof image !== "object" || image === null) return refuse("invalid");
    const { key, side } = image as Record<string, unknown>;
    if (!isImageKey(key) || (side !== "problem" && side !== "answer")) return refuse("invalid");
    if (seen[side].has(key)) return refuse("duplicate");
    seen[side].add(key);
    if (seen[side].size > IMAGES_PER_SIDE) return refuse("too-many");
    rows.push({ key, side, position: seen[side].size });
  }
  return ok(rows);
}

function emptyToNull(value: string): string | null {
  return value === "" ? null : value;
}
