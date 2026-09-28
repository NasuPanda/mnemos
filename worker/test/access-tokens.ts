import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTPayload } from "jose";
import type { KeysFor } from "../auth/access";

/** A fake Access team: tokens are signed with a local key pair instead of Cloudflare's. */
export const TEAM = "https://mnemos-test.cloudflareaccess.com";
export const AUD = "mnemos-test-aud";

const KID = "test-key";
const { publicKey, privateKey } = await generateKeyPair("RS256", { extractable: true });
const jwks = { keys: [{ ...(await exportJWK(publicKey)), kid: KID, alg: "RS256", use: "sig" }] };

export const testKeys: KeysFor = () => createLocalJWKSet(jwks);

type TokenOptions = {
  issuer?: string;
  audience?: string;
  /** Seconds since the epoch, or a jose time span such as "1h". */
  expiresAt?: number | string;
  signingKey?: CryptoKey;
};

/** A Cf-Access-Jwt-Assertion token as Access would send it; override any part to break it. */
export function accessToken(
  claims: JWTPayload = { email: "alice@example.com" },
  opts: TokenOptions = {},
) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256", kid: KID })
    .setIssuer(opts.issuer ?? TEAM)
    .setAudience(opts.audience ?? AUD)
    .setIssuedAt(typeof opts.expiresAt === "number" ? opts.expiresAt - 3600 : undefined)
    .setExpirationTime(opts.expiresAt ?? "1h")
    .sign(opts.signingKey ?? privateKey);
}

/** A key the team never published, for forged tokens. */
export async function strangerKey(): Promise<CryptoKey> {
  return (await generateKeyPair("RS256")).privateKey;
}
