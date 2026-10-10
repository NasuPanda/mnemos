import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { getDb } from "../db/client";
import { itemImages, items } from "../db/schema";
import type { AppEnv } from "../env";

/** Images are named by the SHA-256 of their content, so a name never changes meaning. */
const IMAGE_KEY = /^[0-9a-f]{64}\.(webp|jpg|png)$/;

/**
 * GET /img/:key: streams one of the person's images from R2. Images stay behind the login and
 * are only served to someone whose items use them. Their content never changes, so the browser
 * may keep them for a year.
 */
export const images = new Hono<AppEnv>().get("/:key", async (c) => {
  const key = c.req.param("key");
  if (!IMAGE_KEY.test(key)) return c.json({ error: "not_found" }, 404);

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
