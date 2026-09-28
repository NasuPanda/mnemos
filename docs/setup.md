# Mnemos — setup

How to run Mnemos locally, and the one-time steps in Cloudflare and Google that put it online behind Google login. The reasons behind these choices are in the Login section of `docs/design-plan.md`.

## Local development

1. Install Node from `.tool-versions` (`asdf install`), then run `npm install`.
2. Install the test browsers: `npx playwright install chromium webkit`.
3. Copy `.dev.vars.example` to `.dev.vars`. Access doesn't sit in front of localhost, so the Worker signs you in as `DEV_USER_EMAIL` instead, and only on localhost.
4. Create the local database: `npm run db:migrate:local`, then `npm run db:seed`.
5. Start the app: `npm run dev`, then open http://localhost:5173.
6. Optional, macOS only: rebuild the mockup PNGs, which aren't in git, with `swift scripts/split-mockups.swift docs/design/visual-directions.pdf docs/design`.

Checks: `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:e2e`.

## Going online (one time)

The app lives at `https://mnemos.<your-subdomain>.workers.dev`. `<team>` below is the Zero Trust team name you choose in step A2.

### A. Cloudflare account

1. **R2:** in the Cloudflare dashboard, open R2 Object Storage and enable it. It asks for a card; the free amounts still apply, and use beyond them is billed, not blocked.
2. **Zero Trust:** open Zero Trust from the dashboard, pick a team name and the Free plan. Your team domain is `https://<team>.cloudflareaccess.com`.
3. **Wrangler:** in the Claude Code session, run `! npx wrangler login` and approve it in the browser. On the first deploy Cloudflare may ask you to pick a `workers.dev` subdomain.

### B. Google Cloud Console

4. Create a new project called "Mnemos".
5. Open **Google Auth Platform** (APIs & Services → OAuth consent screen) → **Get started**:
   - app name "Mnemos" and a user support email;
   - audience **External**;
   - your contact email, then agree and **Create**.
6. **Audience → Publish app.** Mnemos asks only for the basic sign-in scopes (openid, email, profile), so Google doesn't review it. Don't upload a logo, because a logo triggers brand verification. Keeping the app in Testing mode also works, but then every person must be added under Test users.
7. **Clients → Create client → Web application**, named "Cloudflare Access":
   - Authorized JavaScript origin: `https://<team>.cloudflareaccess.com`
   - Authorized redirect URI: `https://<team>.cloudflareaccess.com/cdn-cgi/access/callback`
   - Copy the **client ID** and **client secret** right away; the secret may be shown only once.

### C. Zero Trust

8. **Integrations → Identity providers → Add new identity provider → Google:**
   - paste the client ID and secret;
   - turn on **PKCE**;
   - Save, then select **Test** next to Google and sign in.
9. **Access controls → Access settings → Global session duration → 1 month.**
10. **Access controls → Policies → Add a policy:**
    - name "Mnemos users", action **Allow**;
    - Include → **Emails** → your Google address;
    - session duration: same as the application.

### D. After the first deploy

11. **Workers & Pages → mnemos → Access tab → Protect this Worker:**
    - choose **All traffic**;
    - under the authentication policy, select the existing **"Mnemos users"** policy;
    - never choose **Email domain** with gmail.com: it would let every Gmail user in;
    - Apply.
12. **Zero Trust → Access controls → Applications →** the mnemos application **→ Configure:**
    - Login methods: **Google only** (untick Cloudflare and One-time PIN);
    - turn on **Instant Auth**, so Access skips the provider picker;
    - Session duration: **1 month**.
13. Copy two values into `wrangler.jsonc` → `vars`, then deploy again (`npm run deploy`). Neither value is secret.
    - **Team domain** (Zero Trust → Settings → Team name and domain) goes in `ACCESS_TEAM_DOMAIN`.
    - **Application Audience (AUD) tag** (the application's Overview) goes in `ACCESS_AUD`.
    - Until both are set, every API request answers 401.
14. Open the `workers.dev` address on your laptop and your phone. It should ask for Google, then show "Signed in as \<your email\>".

## Deploying

The first deploy creates the resources. Every later deploy is only the last two commands.

```sh
npx wrangler d1 create mnemos                # put the printed database_id into wrangler.jsonc
npx wrangler r2 bucket create mnemos-images
npm run db:migrate:remote
npm run deploy
```

## Adding a friend

- Zero Trust → Access controls → Policies → "Mnemos users" → add their email under Include → Emails.
- If the Google app is still in Testing mode, also add them as a test user in Google Auth Platform → Audience.
- Access allows up to 50 users on the free plan.
