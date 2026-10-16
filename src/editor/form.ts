import { checkItemText, ITEM_LIMITS, type ItemFieldProblem, type ItemTextField } from "@/core";
import type { ImageDto, ItemDto, ItemFieldsRequest } from "../../worker/contract";

export type ImageSide = ImageDto["side"];

/**
 * An image in the editor. A new one has a local preview while it uploads; an existing one is
 * already stored. Only stored images are saved with the item.
 */
export type EditorImage = {
  /** Stable while the editor is open, for React keys and drag and drop. */
  id: string;
  side: ImageSide;
  /** The stored name, once known: "<sha256>.webp". */
  key: string | null;
  /** What the thumbnail shows: /img/<key>, or a local blob: URL while uploading. */
  src: string;
  status: "preparing" | "uploading" | "stored" | "failed";
};

/** What the person is editing: every field as typed, plus the images. */
export type ItemForm = {
  sectionId: number | null;
  name: string;
  description: string;
  problemUrl: string;
  problemText: string;
  answerUrl: string;
  answerText: string;
  sideNote: string;
  images: EditorImage[];
};

export type FormField = ItemTextField | "sectionId";
export type FormProblems = Partial<Record<FormField, string>>;

export function emptyForm(sectionId: number | null): ItemForm {
  return {
    sectionId,
    name: "",
    description: "",
    problemUrl: "",
    problemText: "",
    answerUrl: "",
    answerText: "",
    sideNote: "",
    images: [],
  };
}

export function formFromItem(item: ItemDto): ItemForm {
  return {
    sectionId: item.sectionId,
    name: item.name,
    description: item.description ?? "",
    problemUrl: item.problemUrl ?? "",
    problemText: item.problemText ?? "",
    answerUrl: item.answerUrl ?? "",
    answerText: item.answerText ?? "",
    sideNote: item.sideNote ?? "",
    images: item.images.map((image) => ({
      id: `${image.side}:${image.key}`,
      side: image.side,
      key: image.key,
      src: `/img/${image.key}`,
      status: "stored",
    })),
  };
}

const TEXT_FIELDS = [
  "name",
  "description",
  "problemUrl",
  "problemText",
  "answerUrl",
  "answerText",
  "sideNote",
] as const;

/** Whether leaving now would lose anything: a changed field, or a changed image list. */
export function isDirty(initial: ItemForm, current: ItemForm): boolean {
  if (initial.sectionId !== current.sectionId) return true;
  if (TEXT_FIELDS.some((field) => initial[field] !== current[field])) return true;
  const images = (form: ItemForm) => form.images.map((i) => `${i.side}:${i.id}`).join(",");
  return images(initial) !== images(current);
}

const MESSAGES: Record<ItemFieldProblem, (field: ItemTextField) => string> = {
  required: () => "Give the item a name.",
  "too-long": (field) =>
    field === "name"
      ? `Keep the name to ${ITEM_LIMITS.name.toLocaleString("en-GB")} characters.`
      : field === "description"
        ? `Keep the description to ${ITEM_LIMITS.description.toLocaleString("en-GB")} characters.`
        : field === "problemUrl" || field === "answerUrl"
          ? "This link is too long."
          : `Keep this to ${ITEM_LIMITS.markdown.toLocaleString("en-GB")} characters.`,
  "not-a-link": () => "Use a web link, like example.edu/notes.",
};

/** One plain sentence per problem, as the editor shows them under each field. */
export function problemMessages(
  problems: Partial<Record<ItemTextField, ItemFieldProblem>>,
): FormProblems {
  const messages: FormProblems = {};
  for (const [field, problem] of Object.entries(problems) as [ItemTextField, ItemFieldProblem][]) {
    messages[field] = MESSAGES[problem](field);
  }
  return messages;
}

/** Checks the form the way the Worker will (src/core), plus the section the Worker needs. */
export function checkForm(form: ItemForm): FormProblems {
  const checked = checkItemText(form);
  const problems = checked.ok ? {} : problemMessages(checked.error);
  if (form.sectionId === null) {
    problems.sectionId = "Pick a section, or type a new name to create one.";
  }
  return problems;
}

/** The fields in the order they appear, for focusing the first one with a problem. */
export const FIELD_ORDER: FormField[] = [
  "name",
  "sectionId",
  "description",
  "problemText",
  "problemUrl",
  "answerText",
  "answerUrl",
  "sideNote",
];

/** The save request: every field, and each side's stored images in order. */
export function toRequest(form: ItemForm & { sectionId: number }): ItemFieldsRequest {
  return {
    sectionId: form.sectionId,
    name: form.name,
    description: form.description,
    problemUrl: form.problemUrl,
    problemText: form.problemText,
    answerUrl: form.answerUrl,
    answerText: form.answerText,
    sideNote: form.sideNote,
    images: form.images.flatMap((image) =>
      image.status === "stored" && image.key ? [{ key: image.key, side: image.side }] : [],
    ),
  };
}

/** The id a field's control points to with aria-describedby: its problem, else its help. */
export function describedBy(
  id: string,
  error: string | undefined,
  help: boolean,
): string | undefined {
  if (error) return `${id}-problem`;
  return help ? `${id}-help` : undefined;
}
