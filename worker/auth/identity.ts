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

/**
 * One read on every request; writes only on someone's first login, which creates the user and
 * their settings (default ladder, colour counter at M2) together.
 */
async function findOrCreateUser(db: Db, email: string) {
  const columns = { id: users.id, email: users.email };
  const [existing] = await db.select(columns).from(users).where(eq(users.email, email));
  if (existing) return existing;

  // One D1 batch, so a person never exists without settings.
  const d1 = db.$client;
  await d1.batch([
    d1.prepare("INSERT INTO users (email) VALUES (?) ON CONFLICT (email) DO NOTHING").bind(email),
    d1
      .prepare(
        "INSERT INTO settings (user_id) SELECT id FROM users WHERE email = ? ON CONFLICT DO NOTHING",
      )
      .bind(email),
  ]);

  // Read back, whether we created the row or another request did between our read and write.
  const [created] = await db.select(columns).from(users).where(eq(users.email, email));
  if (!created) throw new Error("user row missing after insert");
  return created;
}
