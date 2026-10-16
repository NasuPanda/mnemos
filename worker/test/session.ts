import { env } from "cloudflare:test";
import { createApp } from "../app";
import { accessToken, AUD, TEAM, testKeys } from "./access-tokens";

const app = createApp(testKeys);
const deployed = { ...env, ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD };
const ORIGIN = "https://mnemos.example.workers.dev";

export type Session = {
  userId: number;
  get: (path: string) => Promise<Response>;
  getWith: (path: string, headers: Record<string, string>) => Promise<Response>;
  post: (path: string, body: unknown) => Promise<Response>;
  put: (path: string, body: unknown) => Promise<Response>;
  patch: (path: string, body: unknown) => Promise<Response>;
  /** A raw request, for bodies that aren't JSON. */
  send: (path: string, init: RequestInit) => Promise<Response>;
  del: (path: string) => Promise<Response>;
};

/** Signs in through Access (a test-signed token) and returns helpers for that person's requests. */
export async function signIn(email: string): Promise<Session> {
  const token = await accessToken({ email });
  const request = async (path: string, init: RequestInit = {}) =>
    app.request(
      `${ORIGIN}${path}`,
      { ...init, headers: { "Cf-Access-Jwt-Assertion": token, ...init.headers } },
      deployed,
    );

  const me = await request("/api/me");
  if (me.status !== 200) throw new Error(`sign-in failed: ${me.status}`);
  const row = await env.DB.prepare("SELECT id FROM users WHERE email = ?")
    .bind(email.toLowerCase())
    .first<{ id: number }>();
  if (!row) throw new Error("user row missing");

  return {
    userId: row.id,
    get: (path) => request(path),
    getWith: (path, headers) => request(path, { headers }),
    post: (path, body) => request(path, json("POST", body)),
    put: (path, body) => request(path, json("PUT", body)),
    patch: (path, body) => request(path, json("PATCH", body)),
    send: request,
    del: (path) => request(path, { method: "DELETE" }),
  };
}

function json(method: string, body: unknown): RequestInit {
  return { method, body: JSON.stringify(body), headers: { "Content-Type": "application/json" } };
}
