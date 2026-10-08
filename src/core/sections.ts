import { ok, refuse, type Result } from "./result";

/** A section's metro line colour: M2 red, M3 blue, M4 green. */
export type Line = "m2" | "m3" | "m4";

/** The colour counter's cycle; a new account starts at M2. */
export const LINES: readonly Line[] = ["m2", "m3", "m4"];
export const FIRST_LINE: Line = "m2";

/** The colour after `line`: M2 → M3 → M4 → M2. */
export function nextLine(line: Line): Line {
  return LINES[(LINES.indexOf(line) + 1) % LINES.length] as Line;
}

/**
 * Colours a new section from the person's counter (`settings.next_line`) and moves the counter
 * on. The counter only moves forward, so reordering or deleting sections never changes a colour.
 */
export function assignLine(counter: Line): { line: Line; nextLine: Line } {
  return { line: counter, nextLine: nextLine(counter) };
}

const CODE_CHARACTERS = /^[A-Z0-9]*$/;
export const MIN_CODE_LENGTH = 2;
export const MAX_CODE_LENGTH = 3;

/** Codes are stored in capitals without surrounding spaces: " sql " is "SQL". */
export function normalizeCode(input: string): string {
  return input.trim().toUpperCase();
}

export type CodeProblem = "characters" | "length" | "taken";

/**
 * Checks a code the person typed: 2–3 characters, A–Z and 0–9 only, and not used by another of
 * their sections. Any valid code is accepted, whether or not it matches the suggestion.
 *
 * @param otherCodes the codes of the person's other sections; leave out the section being edited.
 */
export function validateCode(
  input: string,
  otherCodes: Iterable<string>,
): Result<string, CodeProblem> {
  const code = normalizeCode(input);
  if (!CODE_CHARACTERS.test(code)) return refuse("characters");
  if (code.length < MIN_CODE_LENGTH || code.length > MAX_CODE_LENGTH) return refuse("length");
  if (new Set([...otherCodes].map(normalizeCode)).has(code)) return refuse("taken");
  return ok(code);
}

/**
 * Suggests a code from a section's name; the person can always type their own instead.
 *
 * - Accents are stripped (Gráfok → GRA).
 * - Two or more words give the initials of the first three (Data structures → DS,
 *   Operating systems 2 → OS2).
 * - One word gives its first three letters (Compilers → COM), without camelCase splitting
 *   (TypeScript → TYP).
 * - A taken code has its last character swapped for 2–9 (COM → CO2, DS → DS2), and a one-letter
 *   name gets a digit (C → C2).
 * - A name with no usable letters, or with every candidate taken, gets no suggestion (null).
 */
export function suggestCode(name: string, takenCodes: Iterable<string>): string | null {
  const words = name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);
  const [first] = words;
  if (first === undefined) return null;

  const base =
    words.length >= 2
      ? words
          .slice(0, 3)
          .map((word) => word[0])
          .join("")
      : first.slice(0, 3);
  const taken = new Set([...takenCodes].map(normalizeCode));
  if (base.length >= MIN_CODE_LENGTH && !taken.has(base)) return base;

  const prefix = base.length === MAX_CODE_LENGTH ? base.slice(0, -1) : base;
  for (let digit = 2; digit <= 9; digit++) {
    const candidate = `${prefix}${digit}`;
    if (!taken.has(candidate)) return candidate;
  }
  return null;
}
