import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { IMAGES_PER_PERSON, isImageKey, MAX_IMAGE_BYTES } from "../../src/core";
import type { UploadImageResponse } from "../contract";
import { getDb } from "../db/client";
import { countImages } from "../db/items";
import { itemImages, items } from "../db/schema";
import type { AppEnv } from "../env";

/** What the browser uploads: its shrunk image as WebP, or JPEG where it can't make WebP. */
const UPLOAD_TYPES: Record<string, string> = { webp: "image/webp", jpg: "image/jpeg" };

/**
 * GET /img/:key: streams one of the person's images from R2. Images stay behind the login and
 * are only served to someone whose items use them. Their content never changes, so the browser
 * may keep them for a year.
 */
export const images = new Hono<AppEnv>().get("/:key", async (c) => {
  const key = c.req.param("key");
  // Images are named by the SHA-256 of their content, so a name never changes meaning.
  if (!isImageKey(key)) return c.json({ error: "not_found" }, 404);

  const [used] = await getDb(c.env.DB)
    .select({ id: itemImages.id })
    .from(itemImages)
    .innerJoin(items, eq(items.id, itemImages.itemId))
    .where(and(eq(itemImages.imageKey, key), eq(items.userId, c.var.user.id)))
    .limit(1);
  if (!used) return c.json({ error: "not_found" }, 404);

  const object = await c.env.IMAGES.get(key, { onlyIf: c.req.raw.headers });
  if (!object) return c.json({ error: "not_found" }, 404);

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("ETag", object.httpEtag);
  headers.set("Cache-Control", "private, max-age=31536000, immutable");
  headers.set("X-Content-Type-Options", "nosniff");
  if (!headers.has("Content-Type")) headers.set("Content-Type", contentTypeFor(key));

  // With If-None-Match matching, R2 returns the object without a body: the browser's copy is current.
  if (!("body" in object)) return new Response(null, { status: 304, headers });
  return new Response(object.body, { headers });
});

function contentTypeFor(key: string): string {
  if (key.endsWith(".png")) return "image/png";
  if (key.endsWith(".jpg")) return "image/jpeg";
  return "image/webp";
}

/**
 * PUT /api/images/:key: stores an image the browser has shrunk and named by its SHA-256. The
 * file streams straight into R2, and R2 itself checks that the content matches the name, so no
 * one can store something else under an image's name. An image already stored isn't written
 * again. The image is served only once one of the person's items uses it.
 */
export const imageUploads = new Hono<AppEnv>().put("/:key", async (c) => {
  const key = c.req.param("key");
  const [hash, extension] = key.split(".");
  const type = extension ? UPLOAD_TYPES[extension] : undefined;
  if (!isImageKey(key) || !hash || !type) return c.json({ error: "not-an-image-name" }, 400);
  if (c.req.header("Content-Type") !== type) return c.json({ error: "wrong-type" }, 415);

  const length = Number(c.req.header("Content-Length"));
  if (!Number.isSafeInteger(length) || length <= 0)
    return c.json({ error: "length-required" }, 411);
  if (length > MAX_IMAGE_BYTES) return c.json({ error: "too-large" }, 413);

  if ((await countImages(getDb(c.env.DB), c.var.user.id)) >= IMAGES_PER_PERSON) {
    return c.json({ error: "images-limit" }, 422);
  }

  const response: UploadImageResponse = { key };
  if (await c.env.IMAGES.head(key)) return c.json(response, 200);

  try {
    await c.env.IMAGES.put(key, c.req.raw.body, {
      sha256: hash,
      httpMetadata: { contentType: type },
    });
  } catch (error) {
    if (/sha-?256|checksum|digest/i.test(String(error))) {
      return c.json({ error: "content-does-not-match-name" }, 400);
    }
    throw error;
  }
  return c.json(response, 201);
});
