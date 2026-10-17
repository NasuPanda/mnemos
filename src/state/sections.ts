import { ok, refuse, type Result } from "@/core";
import { ApiError, del, patchJson, postJson, putJson } from "@/lib/api";
import type {
  DeleteSectionResponse,
  SectionDto,
  SectionProblem,
  SectionResponse,
  SectionsResponse,
} from "../../worker/contract";
import { refreshDays } from "./day-store";
import { dropItems, refreshItems } from "./items-store";
import { orderSections, putSection, refreshToday } from "./today-store";

/** One plain sentence for each reason a name or code is refused. */
export function sectionProblemMessage(problem: SectionProblem, code = ""): string {
  switch (problem) {
    case "name-required":
      return "Type a name for the section.";
    case "name-too-long":
      return "Keep the name to 60 characters.";
    case "code-characters":
      return "Use only letters A–Z and digits 0–9.";
    case "code-length":
      return "Use 2 or 3 letters or digits.";
    case "code-taken":
      return code
        ? `Another section already uses ${code.trim().toUpperCase()}.`
        : "That code is taken.";
  }
}

const OFFLINE = "That didn’t go through. Check your connection and try again.";

function failure(error: unknown, code?: string): string {
  if (error instanceof ApiError && error.code) {
    const known: SectionProblem[] = [
      "name-required",
      "name-too-long",
      "code-characters",
      "code-length",
      "code-taken",
    ];
    if (known.includes(error.code as SectionProblem)) {
      return sectionProblemMessage(error.code as SectionProblem, code);
    }
  }
  return OFFLINE;
}

/** Creates a section with the next colour; it shows everywhere at once. */
export async function createSection(
  name: string,
  code: string,
): Promise<Result<SectionDto, string>> {
  try {
    const { section, nextLine } = await postJson<SectionResponse>("/api/sections", { name, code });
    putSection(section, nextLine);
    return ok(section);
  } catch (error) {
    return refuse(failure(error, code));
  }
}

/** Renames a section or changes its code. */
export async function updateSection(
  id: number,
  change: { name?: string; code?: string },
): Promise<Result<SectionDto, string>> {
  try {
    const { section } = await patchJson<SectionResponse>(`/api/sections/${id}`, change);
    putSection(section);
    return ok(section);
  } catch (error) {
    return refuse(failure(error, change.code));
  }
}

/** Saves a new section order, shown at once; if the Worker refuses, today is fetched again. */
export async function reorderSections(ids: number[]): Promise<Result<SectionDto[], string>> {
  orderSections(ids);
  try {
    const { sections } = await putJson<SectionsResponse>("/api/sections/order", { ids });
    void refreshToday();
    return ok(sections);
  } catch (error) {
    void refreshToday();
    return refuse(failure(error));
  }
}

/** Deletes a section with all its items and their reviews. */
export async function deleteSection(id: number): Promise<Result<number, string>> {
  try {
    const { deletedItems } = await del<DeleteSectionResponse>(`/api/sections/${id}`);
    dropItems((item) => item.sectionId !== id);
    void refreshToday();
    void refreshItems();
    refreshDays();
    return ok(deletedItems);
  } catch (error) {
    return refuse(failure(error));
  }
}
