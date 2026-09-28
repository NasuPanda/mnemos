import type { User } from "./db/schema";

/** Hono types for the Worker: bindings from wrangler.jsonc plus the signed-in user. */
export type AppEnv = {
  Bindings: Env & {
    /** Local development only, from .dev.vars; ignored on any host but localhost. */
    DEV_USER_EMAIL?: string;
  };
  Variables: {
    user: Pick<User, "id" | "email">;
  };
};
