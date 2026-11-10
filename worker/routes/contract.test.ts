import { env } from "cloudflare:test";
import { afterAll, vi } from "vitest";
import { describeApiContract } from "../../src/lib/api-contract";
import { httpApi } from "../../src/lib/api";
import { createApp } from "../app";
import { accessToken, AUD, TEAM, testKeys } from "../test/access-tokens";

const app = createApp(testKeys);
const deployed = { ...env, ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD };
const ORIGIN = "https://mnemos.example.workers.dev";
let people = 0;

/**
 * A new person, signed in through Access: the app's own httpApi talks to the Worker, with fetch
 * handing each request to the Hono app.
 */
async function newAccount() {
  const token = await accessToken({ email: `contract-${++people}@example.com` });
  vi.stubGlobal("fetch", (path: string, init: RequestInit = {}) =>
    app.request(
      `${ORIGIN}${path}`,
      { ...init, headers: { ...init.headers, "Cf-Access-Jwt-Assertion": token } },
      deployed,
    ),
  );
  return httpApi;
}

afterAll(() => {
  vi.unstubAllGlobals();
});

describeApiContract("the Worker", newAccount);
