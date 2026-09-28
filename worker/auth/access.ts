import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

/** Resolves the signing keys for a team domain; tests pass local keys instead of fetching. */
export type KeysFor = (teamDomain: string) => JWTVerifyGetKey;

/** "team.cloudflareaccess.com/" and "https://team.cloudflareaccess.com" both become the latter. */
export function normalizeTeamDomain(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  return /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
}

const remoteKeys = new Map<string, JWTVerifyGetKey>();

/** The team's public keys from /cdn-cgi/access/certs, fetched once and cached by jose. */
export const accessKeys: KeysFor = (teamDomain) => {
  let keys = remoteKeys.get(teamDomain);
  if (!keys) {
    keys = createRemoteJWKSet(new URL(`${teamDomain}/cdn-cgi/access/certs`));
    remoteKeys.set(teamDomain, keys);
  }
  return keys;
};

/**
 * Checks a Cf-Access-Jwt-Assertion token: signed by the team, issued by the team domain, for this
 * application's audience, and not expired. Returns the signed-in email in lowercase.
 * Throws if any check fails.
 * https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
 */
export async function verifyAccessJwt(
  token: string,
  options: { teamDomain: string; aud: string; keysFor: KeysFor },
): Promise<string> {
  const teamDomain = normalizeTeamDomain(options.teamDomain);
  const { payload } = await jwtVerify(token, options.keysFor(teamDomain), {
    issuer: teamDomain,
    audience: options.aud,
    algorithms: ["RS256"],
  });
  // Service tokens carry no email; only people use Mnemos.
  if (typeof payload.email !== "string" || !payload.email.includes("@")) {
    throw new Error("Access token has no email");
  }
  return payload.email.toLowerCase();
}
