import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { createApp } from "../app";
import { accessToken, AUD, TEAM, testKeys } from "../test/access-tokens";

const app = createApp(testKeys);
const deployed = { ...env, ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD };

async function signIn(email: string): Promise<number> {
  const res = await app.request(
    "https://mnemos.example.workers.dev/api/me",
    { headers: { "Cf-Access-Jwt-Assertion": await accessToken({ email }) } },
    deployed,
  );
  expect(res.status).toBe(200);
  const row = await env.DB.prepare("SELECT id FROM users WHERE email = ?")
    .bind(email)
    .first<{ id: number }>();
  if (!row) throw new Error("user not created");
  return row.id;
}

const run = (sql: string, ...values: unknown[]) =>
  env.DB.prepare(sql)
    .bind(...values)
    .run();

describe("Settings", () => {
  it("are created on first login with the default ladder and the colour counter at M2", async () => {
    const userId = await signIn("ines@example.com");
    const row = await env.DB.prepare(
      "SELECT ladder_days, next_line FROM settings WHERE user_id = ?",
    )
      .bind(userId)
      .first<{ ladder_days: string; next_line: string }>();
    expect(row).toEqual({ ladder_days: "[1,2,3,5,7,14,28]", next_line: "m2" });
  });

  it("are created once, however many times the person signs in", async () => {
    const userId = await signIn("jan@example.com");
    await signIn("jan@example.com");
    const { results } = await env.DB.prepare("SELECT user_id FROM settings WHERE user_id = ?")
      .bind(userId)
      .all();
    expect(results).toHaveLength(1);
  });

  it("only accept M2, M3 or M4 as the next colour", async () => {
    const userId = await signIn("kai@example.com");
    await expect(
      run("UPDATE settings SET next_line = 'm9' WHERE user_id = ?", userId),
    ).rejects.toThrow();
  });
});

describe("Database rules", () => {
  async function sectionFor(userId: number, code: string) {
    const row = await env.DB.prepare(
      "INSERT INTO sections (user_id, name, code, line, position) VALUES (?, ?, ?, 'm2', 1) RETURNING id",
    )
      .bind(userId, `Section ${code}`, code)
      .first<{ id: number }>();
    if (!row) throw new Error("section not created");
    return row.id;
  }

  async function itemIn(userId: number, sectionId: number) {
    const row = await env.DB.prepare(
      "INSERT INTO items (user_id, section_id, name, due_on) VALUES (?, ?, 'Item', '2026-09-24') RETURNING id, stop",
    )
      .bind(userId, sectionId)
      .first<{ id: number; stop: number }>();
    if (!row) throw new Error("item not created");
    return row;
  }

  it("keeps section codes unique per person, but lets two people use the same code", async () => {
    const lea = await signIn("lea@example.com");
    const max = await signIn("max@example.com");
    await sectionFor(lea, "GR");
    await expect(sectionFor(lea, "GR")).rejects.toThrow();
    await expect(sectionFor(max, "GR")).resolves.toBeTypeOf("number");
  });

  it("only accepts M2, M3 or M4 as a section's line", async () => {
    const userId = await signIn("nia@example.com");
    await expect(
      run(
        "INSERT INTO sections (user_id, name, code, line, position) VALUES (?, 'X', 'X1', 'red', 1)",
        userId,
      ),
    ).rejects.toThrow();
  });

  it("starts new items on stop 1, and never below it", async () => {
    const userId = await signIn("oto@example.com");
    const item = await itemIn(userId, await sectionFor(userId, "OT"));
    expect(item.stop).toBe(1);
    await expect(run("UPDATE items SET stop = 0 WHERE id = ?", item.id)).rejects.toThrow();
  });

  it("allows one review per item per day", async () => {
    const userId = await signIn("pia@example.com");
    const item = await itemIn(userId, await sectionFor(userId, "PI"));
    const review = (day: string) =>
      run(
        `INSERT INTO reviews (user_id, item_id, reviewed_on, confidence, stop_before, stop_after, was_due_on, next_due_on)
         VALUES (?, ?, ?, 'neutral', 1, 1, '2026-09-24', '2026-09-25')`,
        userId,
        item.id,
        day,
      );
    await review("2026-09-24");
    await expect(review("2026-09-24")).rejects.toThrow();
    await expect(review("2026-09-25")).resolves.toBeDefined();
  });

  it("only accepts the three confidence levels", async () => {
    const userId = await signIn("quinn@example.com");
    const item = await itemIn(userId, await sectionFor(userId, "QU"));
    await expect(
      run(
        `INSERT INTO reviews (user_id, item_id, reviewed_on, confidence, stop_before, stop_after, was_due_on, next_due_on)
         VALUES (?, ?, '2026-09-24', 'great', 1, 2, '2026-09-24', '2026-09-26')`,
        userId,
        item.id,
      ),
    ).rejects.toThrow();
  });

  it("deletes an item's images and reviews with the item", async () => {
    const userId = await signIn("rui@example.com");
    const item = await itemIn(userId, await sectionFor(userId, "RU"));
    await run(
      "INSERT INTO item_images (item_id, side, image_key, position) VALUES (?, 'problem', 'abc.webp', 1)",
      item.id,
    );
    await run(
      `INSERT INTO reviews (user_id, item_id, reviewed_on, confidence, stop_before, stop_after, was_due_on, next_due_on)
       VALUES (?, ?, '2026-09-24', 'neutral', 1, 1, '2026-09-24', '2026-09-25')`,
      userId,
      item.id,
    );
    await run("DELETE FROM items WHERE id = ?", item.id);
    const images = await env.DB.prepare("SELECT id FROM item_images WHERE item_id = ?")
      .bind(item.id)
      .all();
    const reviews = await env.DB.prepare("SELECT id FROM reviews WHERE item_id = ?")
      .bind(item.id)
      .all();
    expect(images.results).toHaveLength(0);
    expect(reviews.results).toHaveLength(0);
  });

  it("only accepts problem or answer as an image's side", async () => {
    const userId = await signIn("sam@example.com");
    const item = await itemIn(userId, await sectionFor(userId, "SA"));
    await expect(
      run(
        "INSERT INTO item_images (item_id, side, image_key, position) VALUES (?, 'middle', 'abc.webp', 1)",
        item.id,
      ),
    ).rejects.toThrow();
  });
});
