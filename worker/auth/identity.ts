import { eq } from "drizzle-orm";
import { createMiddleware } from "hono/factory";
import { getDb, type Db } from "../db/client";
import { users } from "../db/schema";
import type { AppEnv } from "../env";
import { verifyAccessJwt, type KeysFor } from "./access";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Works out who is asking, then loads (or creates) their user row. Every route behind it can
 * rely on c.var.user; nothing the browser sends can choose the user.
 *
 * - With an Access token: the token must verify against ACCESS_TEAM_DOMAIN and ACCESS_AUD.
 * - Without one, on localhost only: DEV_USER_EMAIL from .dev.vars.
 * - Anything else, including missing Access settings: 401.
 */
export function identity(keysFor: KeysFor) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const email = await signedInEmail(c.req.raw, c.env, keysFor);
    if (!email) return c.json({ error: "unauthorized" }, 401);

    c.set("user", await findOrCreateUser(getDb(c.env.DB), email));
    await next();
  });
}

async function signedInEmail(
  request: Request,
  env: AppEnv["Bindings"],
  keysFor: KeysFor,
): Promise<string | null> {
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (token) {
    if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return null;
    try {
      return await verifyAccessJwt(token, {
        teamDomain: env.ACCESS_TEAM_DOMAIN,
        aud: env.ACCESS_AUD,
        keysFor,
      });
    } catch {
      return null;
    }
  }

  const devEmail = env.DEV_USER_EMAIL?.trim().toLowerCase();
  if (devEmail && LOCAL_HOSTS.has(new URL(request.url).hostname)) return devEmail;
  return null;
}

/** One read on every request; a write only on someone's first login. */
async function findOrCreateUser(db: Db, email: string) {
  const columns = { id: users.id, email: users.email };
  const [existing] = await db.select(columns).from(users).where(eq(users.email, email));
  if (existing) return existing;

  const [created] = await db
    .insert(users)
    .values({ email })
    .onConflictDoNothing({ target: users.email })
    .returning(columns);
  if (created) return created;

  // Another request created the row between our read and write.
  const [raced] = await db.select(columns).from(users).where(eq(users.email, email));
  if (!raced) throw new Error("user row missing after insert");
  return raced;
}
