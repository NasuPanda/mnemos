import type { Context } from "hono";
import { Hono } from "hono";
import {
  checkItemImages,
  checkItemText,
  IMAGES_PER_PERSON,
  isIsoDate,
  ok,
  refuse,
  type ItemImageInput,
  type ItemText,
  type Result,
} from "../../src/core";
import type { DeleteItemResponse, ItemErrorResponse, ItemsResponse } from "../contract";
import { getDb, type Db } from "../db/client";
import {
  deleteItem,
  imagesInUse,
  insertItem,
  loadItem,
  loadItemList,
  ownsSection,
  updateItem,
} from "../db/items";
import type { AppEnv } from "../env";
import { jsonObject, parseId } from "./params";

const TEXT_FIELDS = [
  "name",
  "description",
  "problemUrl",
  "problemText",
  "answerUrl",
  "answerText",
  "sideNote",
] as const;

type Checked = {
  fields: ItemText & { sectionId: number };
  images: (ItemImageInput & { position: number })[];
};
type Refusal = { status: 400 | 422; body: ItemErrorResponse | { error: string } };

/** Items: the list, one item for the editor, create, save and delete. */
export const itemRoutes = new Hono<AppEnv>()
  /** GET /api/items?date=YYYY-MM-DD: the Items list, flagged by what was reviewed on `date`. */
  .get("/", async (c) => {
    const date = c.req.query("date");
    if (!isIsoDate(date)) return c.json({ error: "date must be YYYY-MM-DD" }, 400);
    const body: ItemsResponse = {
      date,
      items: await loadItemList(getDb(c.env.DB), c.var.user.id, date),
    };
    return c.json(body);
  })
  /** GET /api/items/:id: one item with its images, for the editor. */
  .get("/:id", async (c) => {
    const itemId = parseId(c.req.param("id"));
    if (!itemId) return c.json({ error: "an item id is required" }, 400);
    const found = await loadItem(getDb(c.env.DB), c.var.user.id, itemId);
    return found ? c.json(found) : c.json({ error: "not_found" }, 404);
  })
  /** POST /api/items: a new item on stop 1, due on the browser's today. */
  .post("/", async (c) => {
    const body = await jsonObject(c.req);
    if (!body || !isIsoDate(body.date)) return c.json({ error: "date must be YYYY-MM-DD" }, 400);
    const db = getDb(c.env.DB);
    const userId = c.var.user.id;

    const checked = await checkSave(db, userId, null, body);
    if (!checked.ok) return refusal(c, checked.error);
    const id = await insertItem(db, userId, checked.value.fields, checked.value.images, body.date);
    return c.json(await loadItem(db, userId, id), 201);
  })
  /** PUT /api/items/:id: every field and the image list. The stop and due date stay. */
  .put("/:id", async (c) => {
    const itemId = parseId(c.req.param("id"));
    const body = await jsonObject(c.req);
    if (!itemId || !body) return c.json({ error: "an item id and a body are required" }, 400);
    const db = getDb(c.env.DB);
    const userId = c.var.user.id;

    const checked = await checkSave(db, userId, itemId, body);
    if (!checked.ok) return refusal(c, checked.error);
    const { fields, images } = checked.value;
    if (!(await updateItem(db, userId, itemId, fields, images))) {
      return c.json({ error: "not_found" }, 404);
    }
    return c.json(await loadItem(db, userId, itemId));
  })
  /** DELETE /api/items/:id: the item with its images and reviews. */
  .delete("/:id", async (c) => {
    const itemId = parseId(c.req.param("id"));
    if (!itemId) return c.json({ error: "an item id is required" }, 400);
    if (!(await deleteItem(getDb(c.env.DB), c.var.user.id, itemId))) {
      return c.json({ error: "not_found" }, 404);
    }
    const response: DeleteItemResponse = { id: itemId };
    return c.json(response);
  });

/**
 * Everything a save needs to be true: well-formed fields (src/core), a section of the person's,
 * a valid image list, and no more than 2,000 different images across their items.
 */
async function checkSave(
  db: Db,
  userId: number,
  itemId: number | null,
  body: Record<string, unknown>,
): Promise<Result<Checked, Refusal>> {
  const text: Partial<Record<(typeof TEXT_FIELDS)[number], string | null>> = {};
  for (const field of TEXT_FIELDS) {
    const value = body[field];
    if (value !== undefined && value !== null && typeof value !== "string") {
      return refuse({ status: 400, body: { error: `${field} must be text` } });
    }
    text[field] = value ?? null;
  }
  const fields = checkItemText(text);
  if (!fields.ok) {
    return refuse({ status: 422, body: { error: "invalid-fields", fields: fields.error } });
  }

  const images = checkItemImages(body.images ?? []);
  if (!images.ok) {
    const status = images.error === "invalid" ? 400 : 422;
    return refuse({ status, body: { error: `images-${images.error}` } });
  }

  const sectionId = parseId(body.sectionId);
  if (!sectionId || !(await ownsSection(db, userId, sectionId))) {
    return refuse({ status: 422, body: { error: "section-not-found" } });
  }

  const keys = images.value.map((image) => image.key);
  if (keys.length > 0 && (await imagesInUse(db, userId, itemId, keys)) > IMAGES_PER_PERSON) {
    return refuse({ status: 422, body: { error: "images-limit" } });
  }

  return ok({ fields: { ...fields.value, sectionId }, images: images.value });
}

function refusal(c: Context<AppEnv>, { status, body }: Refusal) {
  return c.json(body, status);
}
