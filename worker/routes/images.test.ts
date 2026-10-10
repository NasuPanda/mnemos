import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { addImage, addItem, addSection } from "../test/fixtures";
import { signIn } from "../test/session";

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
