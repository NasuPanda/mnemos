import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { createApp } from "../app";
import { accessToken, AUD, strangerKey, TEAM, testKeys } from "../test/access-tokens";

const app = createApp(testKeys);
const deployed = { ...env, ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD };
const DEPLOYED_URL = "https://mnemos.example.workers.dev/api/me";
const LOCAL_URL = "http://localhost:5173/api/me";

function getMe(url: string, bindings: object, token?: string) {
  const headers: Record<string, string> = token ? { "Cf-Access-Jwt-Assertion": token } : {};
  return app.request(url, { headers }, bindings);
}

async function userRows(email: string) {
  const { results } = await env.DB.prepare("SELECT id FROM users WHERE email = ?")
    .bind(email)
    .all<{ id: number }>();
  return results;
}

describe("GET /api/me behind Access", () => {
  it("returns the signed-in email, read from the users table", async () => {
    const res = await getMe(
      DEPLOYED_URL,
      deployed,
      await accessToken({ email: "bea@example.com" }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ email: "bea@example.com" });
    expect(await userRows("bea@example.com")).toHaveLength(1);
  });

  it("creates the user on first login and reuses the same row afterwards", async () => {
    const token = await accessToken({ email: "cem@example.com" });
    await getMe(DEPLOYED_URL, deployed, token);
    const [first] = await userRows("cem@example.com");
    await getMe(DEPLOYED_URL, deployed, token);

    expect(await userRows("cem@example.com")).toEqual([first]);
  });

  it("treats the email case-insensitively, so one person has one user", async () => {
    await getMe(DEPLOYED_URL, deployed, await accessToken({ email: "Dora@Example.com" }));
    await getMe(DEPLOYED_URL, deployed, await accessToken({ email: "dora@example.com" }));

    expect(await userRows("dora@example.com")).toHaveLength(1);
  });

  it("returns 401 without an Access token", async () => {
    const res = await getMe(DEPLOYED_URL, deployed);
    expect(res.status).toBe(401);
  });

  it("returns 401 for a forged token and creates no user", async () => {
    const forged = await accessToken(
      { email: "eve@example.com" },
      { signingKey: await strangerKey() },
    );
    const res = await getMe(DEPLOYED_URL, deployed, forged);

    expect(res.status).toBe(401);
    expect(await userRows("eve@example.com")).toHaveLength(0);
  });

  it("refuses every token while ACCESS_TEAM_DOMAIN or ACCESS_AUD is empty", async () => {
    const token = await accessToken({ email: "finn@example.com" });

    expect((await getMe(DEPLOYED_URL, { ...deployed, ACCESS_AUD: "" }, token)).status).toBe(401);
    expect((await getMe(DEPLOYED_URL, { ...deployed, ACCESS_TEAM_DOMAIN: "" }, token)).status).toBe(
      401,
    );
  });
});

describe("GET /api/me in local development", () => {
  const local = {
    ...env,
    ACCESS_TEAM_DOMAIN: "",
    ACCESS_AUD: "",
    DEV_USER_EMAIL: "Dev@Mnemos.local",
  };

  it("signs in as DEV_USER_EMAIL on localhost", async () => {
    const res = await getMe(LOCAL_URL, local);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ email: "dev@mnemos.local" });
  });

  it("ignores DEV_USER_EMAIL on any other host", async () => {
    const res = await getMe(DEPLOYED_URL, local);
    expect(res.status).toBe(401);
  });

  it("does not fall back to DEV_USER_EMAIL when a token is sent but fails", async () => {
    const res = await getMe(LOCAL_URL, local, "not-a-token");
    expect(res.status).toBe(401);
  });
});

describe("unknown API paths", () => {
  it("answer 404 for a signed-in user", async () => {
    const res = await app.request(
      "https://mnemos.example.workers.dev/api/nope",
      { headers: { "Cf-Access-Jwt-Assertion": await accessToken() } },
      deployed,
    );
    expect(res.status).toBe(404);
  });
});
