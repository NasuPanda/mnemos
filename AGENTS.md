# Mnemos — instructions for AI coding agents

Mnemos is a fast study scheduler with a Budapest theme. Items are grouped into sections, and a ladder of review gaps decides when each item comes back. The review loop works from the keyboard on desktop and with one thumb on a phone. A small group of friends uses it, and each person's data is private.

## Sources of truth

- `docs/design-plan.md`: product rules, scheduling rules, counts, data model, architecture, login and images. Read the relevant sections before any change.
- `docs/design/`: the visual design, one PNG per page of the design draft (list in `docs/build-plan.md`). Match the mockups; pages 17–22 are the style sheet.
- `src/styles/tokens.css`: the design tokens from the draft. Components use these tokens only.
- `docs/build-plan.md`: the build order and progress. Work on one phase at a time.

If the code, the docs and the mockups disagree, stop and ask. When a decision changes, update `docs/design-plan.md` in the same commit as the code.

## Stack

- **One Cloudflare Worker**, built with `@cloudflare/vite-plugin` and configured in `wrangler.jsonc`. It serves:
  - the React single-page app as static assets;
  - a Hono API under `/api/*`;
  - images under `/img/*` (the API and image routes are listed in `run_worker_first`).
- **Data:** D1 with Drizzle ORM (migrations in `migrations/`, applied with wrangler); R2 for images.
- **Login:** Cloudflare Access with Google sits in front. The Worker verifies `Cf-Access-Jwt-Assertion` with `jose`; local development uses `DEV_USER_EMAIL` instead.
- **Frontend:**
  - React + TypeScript;
  - Tailwind CSS v4, CSS-first: `@theme` in CSS, no `tailwind.config.js`;
  - shadcn/ui on Radix primitives (`components.json` points at `src/styles/tokens.css`), Motion, and dnd-kit for reordering images.
- **Markdown:** react-markdown + remark-gfm. No raw HTML, no Markdown images, no math.
- **Fonts:** `@fontsource-variable/atkinson-hyperlegible-next` and `-mono`.
- **Tests:**
  - Vitest for the core and the UI;
  - `@cloudflare/vitest-plugin` for the Worker and API (it replaces the older `@cloudflare/vitest-pool-workers`);
  - Playwright for end-to-end runs at 390 × 844 and 1440 × 900.

Libraries change faster than your training data. Before using an API you are not sure about, check the current docs (Cloudflare docs MCP, shadcn MCP). Tailwind v4, the Cloudflare Vite plugin and the Workers Vitest plugin are the usual traps.

## Commands

Create these in phase 0 and keep this list accurate.

- `npm run dev`: local development in the Workers runtime, with local D1 and R2. Needs `.dev.vars` (copy `.dev.vars.example`).
- `npm run preview`: build, then serve the built app in the Workers runtime.
- `npm run typecheck`, `npm run lint` (ESLint and Prettier), `npm run format`, `npm test`, `npm run test:watch`, `npm run test:e2e`.
- `npm run db:generate`, `npm run db:migrate:local`, `npm run db:migrate:remote`, `npm run db:seed`.
- `npm run cf-typegen`: regenerate `worker-configuration.d.ts` after changing `wrangler.jsonc`.
- `npm run deploy`: only when I ask.

Setup, the Cloudflare and Google checklist, and deploying are in `docs/setup.md`.

## Code layout

- `src/core/`: the scheduling rules as pure TypeScript. No React, no database, no clock: "today" is always passed in as a `YYYY-MM-DD` string. It holds:
  - ladder moves, due dates, counts and order;
  - ladder edits and undo;
  - section colours and codes.

  Every rule has unit tests.
- `worker/`: the Hono app. Routes stay thin: they call `src/core` and Drizzle, and nothing else decides scheduling.
- `src/`: the React app. Screens live in `src/screens/`, shared pieces in `src/components/`, and shadcn components in `src/components/ui/`.

## Rules that are easy to get wrong

- **Dates:** due and review dates are plain `YYYY-MM-DD` strings. The browser sends its local date with each request; the server never works out "today" itself.
- **Colour:**
  - Yellow (`primary`, `ring`) only means selected, focused or primary action.
  - Section colours come from the section's stored `line`, never from its position in a list.
  - Nothing is red for errors, and confidence and overdue get no colour at all.
  - Lamplight gold appears only inside illustrations.
  - No raw hex values in components.
- **shadcn:** never use `variant="destructive"`. Delete is a secondary button with a trash icon, and it always asks first.
- **Motion:** 150 ms at most, `prefers-reduced-motion` respected, no spinners or skeletons.
- **Touch:** key hints are hidden on touch screens; tap targets are at least 48 px, and confidence buttons are 56 px.
- **Review screen:** tapping an image opens zoom and tapping a link opens it; neither reveals the answer. The Name stays hidden until the reveal, unless the problem description is empty.
- **Security:** every query is scoped to the user from the Access token. Never trust a user id sent by the browser.
- **Scope:** don't add dependencies, features or screens that aren't in the docs without asking.

## How to work

1. **Plan first.** For a phase or a change, read the docs and mockups it names, then propose a short plan: the files, the tests, and any questions. Wait for my OK before writing code.
2. **Small steps.** One commit per step, each with its tests. Run typecheck, lint and tests before calling anything done.
3. **Check the UI by looking at it.** Run the app, take screenshots at 390 px and 1440 px, compare them with the named mockups, and list any differences you couldn't fix.
4. **Close the phase.** Tick the boxes in `docs/build-plan.md`, note any decision that changed, and tell me what to try on my phone.
5. **Ask, don't guess.** If a rule seems wrong or conflicts with the design, ask./plugin marketplace add cloudflare/skills
/plugin install cloudflare@cloudflare
