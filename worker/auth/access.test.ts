import { describe, expect, it } from "vitest";
import { accessToken, AUD, strangerKey, TEAM, testKeys } from "../test/access-tokens";
import { normalizeTeamDomain, verifyAccessJwt } from "./access";

const options = { teamDomain: TEAM, aud: AUD, keysFor: testKeys };

describe("verifyAccessJwt", () => {
  it("accepts a token from our team for this application and returns the email in lowercase", async () => {
    const token = await accessToken({ email: "Alice@Example.com" });
    await expect(verifyAccessJwt(token, options)).resolves.toBe("alice@example.com");
  });

  it("rejects a token issued for another Access application", async () => {
    const token = await accessToken(undefined, { audience: "some-other-app" });
    await expect(verifyAccessJwt(token, options)).rejects.toThrow();
  });

  it("rejects a token issued by another team", async () => {
    const token = await accessToken(undefined, { issuer: "https://intruder.cloudflareaccess.com" });
    await expect(verifyAccessJwt(token, options)).rejects.toThrow();
  });

  it("rejects an expired token", async () => {
    const token = await accessToken(undefined, { expiresAt: Math.floor(Date.now() / 1000) - 60 });
    await expect(verifyAccessJwt(token, options)).rejects.toThrow();
  });

  it("rejects a token signed with a key the team never published", async () => {
    const token = await accessToken(undefined, { signingKey: await strangerKey() });
    await expect(verifyAccessJwt(token, options)).rejects.toThrow();
  });

  it("rejects a token without an email, such as a service token", async () => {
    const token = await accessToken({ common_name: "ci-service-token" });
    await expect(verifyAccessJwt(token, options)).rejects.toThrow("no email");
  });

  it("rejects something that is not a JWT", async () => {
    await expect(verifyAccessJwt("not-a-token", options)).rejects.toThrow();
  });
});

describe("normalizeTeamDomain", () => {
  it("accepts the team domain with or without https:// and a trailing slash", () => {
    expect(normalizeTeamDomain("mnemos.cloudflareaccess.com")).toBe(
      "https://mnemos.cloudflareaccess.com",
    );
    expect(normalizeTeamDomain("https://mnemos.cloudflareaccess.com/")).toBe(
      "https://mnemos.cloudflareaccess.com",
    );
  });
});
