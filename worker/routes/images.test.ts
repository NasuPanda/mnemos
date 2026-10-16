import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { addImage, addItem, addSection } from "../test/fixtures";
import { signIn, type Session } from "../test/session";

const BYTES = new Uint8Array([82, 73, 70, 70, 1, 2, 3, 4]); // a few bytes standing in for a WebP
const key = (n: number) => `${n.toString(16).padStart(64, "0")}.webp`;

async function ownerOf(email: string, imageKey: string) {
  const session = await signIn(email);
  const section = await addSection(session.userId, { code: "GR" });
  const item = await addItem(session.userId, section, { name: "With image", dueOn: "2026-09-24" });
  await addImage(item, { key: imageKey, side: "problem", position: 1 });
  await env.IMAGES.put(imageKey, BYTES, { httpMetadata: { contentType: "image/webp" } });
  return session;
}

describe("GET /img/:key", () => {
  it("streams the person's image with its type and a year of private, immutable caching", async () => {
    const session = await ownerOf("ali@example.com", key(1));
    const res = await session.get(`/img/${key(1)}`);

    expect(res.status).toBe(200);
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(BYTES);
    expect(res.headers.get("Content-Type")).toBe("image/webp");
    expect(res.headers.get("Cache-Control")).toBe("private, max-age=31536000, immutable");
    expect(res.headers.get("ETag")).toBeTruthy();
  });

  it("answers 304 when the browser already has the image", async () => {
    const session = await ownerOf("bea2@example.com", key(2));
    const first = await session.get(`/img/${key(2)}`);
    const etag = first.headers.get("ETag") ?? "";
    await first.arrayBuffer();

    const again = await signIn("bea2@example.com");
    const res = await again.getWith(`/img/${key(2)}`, { "If-None-Match": etag });
    expect(res.status).toBe(304);
  });

  it("never serves an image to someone whose items don't use it", async () => {
    await ownerOf("cal@example.com", key(3));
    const stranger = await signIn("dan@example.com");
    expect((await stranger.get(`/img/${key(3)}`)).status).toBe(404);
  });

  it("answers 404 for a name that isn't an image key", async () => {
    const session = await signIn("eva@example.com");
    for (const name of ["../secret", "abc.webp", `${key(4).slice(0, -5)}.svg`]) {
      expect((await session.get(`/img/${encodeURIComponent(name)}`)).status, name).toBe(404);
    }
  });

  it("answers 404 when the image is missing from storage", async () => {
    const session = await signIn("fin@example.com");
    const section = await addSection(session.userId, { code: "GR" });
    const item = await addItem(session.userId, section, { name: "Missing", dueOn: "2026-09-24" });
    await addImage(item, { key: key(5), side: "answer", position: 1 });
    expect((await session.get(`/img/${key(5)}`)).status).toBe(404);
  });
});

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function upload(session: Session, name: string, bytes: Uint8Array, type = "image/webp") {
  return session.send(`/api/images/${name}`, {
    method: "PUT",
    body: bytes,
    headers: { "Content-Type": type, "Content-Length": String(bytes.byteLength) },
  });
}

describe("PUT /api/images/:key: uploading an image", () => {
  it("stores it under its SHA-256 name, served once one of the person's items uses it", async () => {
    const session = await signIn("up-a@example.com");
    const bytes = new Uint8Array([82, 73, 70, 70, 9, 8, 7, 6]);
    const name = `${await sha256(bytes)}.webp`;

    const res = await upload(session, name, bytes);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ key: name });
    expect((await session.get(`/img/${name}`)).status).toBe(404);

    const section = await addSection(session.userId, { code: "GR" });
    const item = await addItem(session.userId, section, {
      name: "With photo",
      dueOn: "2026-09-24",
    });
    await addImage(item, { key: name, side: "problem", position: 1 });
    const served = await session.get(`/img/${name}`);
    expect(served.status).toBe(200);
    expect(served.headers.get("Content-Type")).toBe("image/webp");
    expect(new Uint8Array(await served.arrayBuffer())).toEqual(bytes);
  });

  it("takes JPEG too, for browsers that can't make WebP", async () => {
    const session = await signIn("up-b@example.com");
    const bytes = new Uint8Array([255, 216, 255, 224, 1, 2]);
    const res = await upload(session, `${await sha256(bytes)}.jpg`, bytes, "image/jpeg");
    expect(res.status).toBe(201);
  });

  it("doesn't write an image that is already stored", async () => {
    const session = await signIn("up-c@example.com");
    const bytes = new Uint8Array([1, 1, 2, 3, 5, 8]);
    const name = `${await sha256(bytes)}.webp`;
    expect((await upload(session, name, bytes)).status).toBe(201);
    expect((await upload(session, name, bytes)).status).toBe(200);
  });

  it("refuses content that doesn't match its name, and stores nothing", async () => {
    const session = await signIn("up-d@example.com");
    const name = `${await sha256(new Uint8Array([1, 2, 3]))}.webp`;
    const res = await upload(session, name, new Uint8Array([6, 6, 6]));
    expect(res.status).toBe(400);
    expect(await env.IMAGES.head(name)).toBeNull();
  });

  it("refuses files over 2 MB", async () => {
    const session = await signIn("up-e@example.com");
    const bytes = new Uint8Array(2 * 1024 * 1024 + 1);
    const res = await upload(session, `${await sha256(bytes)}.webp`, bytes);
    expect(res.status).toBe(413);
  });

  it("takes only WebP and JPEG, under an image name that matches the type", async () => {
    const session = await signIn("up-f@example.com");
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const hash = await sha256(bytes);
    expect((await upload(session, `${hash}.png`, bytes, "image/png")).status).toBe(400);
    expect((await upload(session, `${hash}.webp`, bytes, "image/jpeg")).status).toBe(415);
    expect((await upload(session, "picture.webp", bytes)).status).toBe(400);
  });

  it("stops once the person's items use 2,000 different images", async () => {
    const session = await signIn("up-g@example.com");
    const section = await addSection(session.userId, { code: "GR" });
    const item = await addItem(session.userId, section, { name: "Full", dueOn: "2026-09-24" });
    await env.DB.prepare(
      `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 2000)
       INSERT INTO item_images (item_id, side, image_key, position)
       SELECT ?, 'problem', printf('%064x.webp', i), i FROM n`,
    )
      .bind(item)
      .run();

    const bytes = new Uint8Array([4, 4, 4]);
    const res = await upload(session, `${await sha256(bytes)}.webp`, bytes);
    expect(res.status).toBe(422);
  });
});
