# Mnemos — instructions for AI coding agents

Mnemos is a fast study scheduler with a Budapest theme. Items are grouped into sections, and a ladder of review gaps decides when each item comes back. The review loop works from the keyboard on desktop and with one thumb on a phone. A small group of friends uses it, and each person's data is private.

## Sources of truth

- `docs/design-plan.md`: product rules, scheduling rules, counts, data model, architecture, login and images. Read the relevant sections before any change.
- `docs/design/`: the visual design, one PNG per page of the design draft (list in `docs/build-plan.md`). Match the mockups, except where `docs/design-plan.md` records a later change; pages 17–22 are the style sheet.
- `src/styles/tokens.css`: the design tokens: the draft's, plus the ones added since (listed in the plan's Visual design). Components use these tokens only.
- `docs/build-plan.md`: the workflow, and what was built, milestone by milestone: what changed while building and the differences from the mockups. Open work isn't listed there; it lives in GitHub issues.
- GitHub issues: the requests. Each says what one change is for and when it's done, and holds its discussion and status. An issue is a request, not a rule: a decision made in an issue thread counts only once it's written in `docs/design-plan.md`.
- The onboarding guide (`docs/onboarding.md`), if you come across it: a snapshot for people joining, not kept up to date. Don't use it as a source.

If the code, the docs and the mockups disagree, stop and ask. When a decision changes, update `docs/design-plan.md` in the same commit as the code. When the change came from an issue, name the issue there, as the plan does for #12 and #13.

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
  - shadcn/ui on Radix primitives (`components.json` points at `src/styles/tokens.css`), tw-animate-css and plain CSS for transitions, and dnd-kit for reordering images and lines.
- **Markdown:** react-markdown + remark-gfm + remark-breaks (a new line is a line break). No raw HTML, no Markdown images, no math.
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
- `npm run db:generate`, `npm run db:migrate:local`, `npm run db:migrate:remote`.
- `npm run db:seed`: replace the dev user's local data with the sample day (`scripts/seed.ts`; `--wipe` deletes it only).
- `npm run db:migrate:e2e`, `npm run db:seed:e2e`: the end-to-end tests' own local database; Playwright runs both.
- `npm run db:seed:remote -- --email=<you>`: the sample day in production. Only when I ask; it asks to type "seed production" (or takes `--confirm="seed production"` where there is no keyboard).
- `npm run cf-typegen`: regenerate `worker-configuration.d.ts` after changing `wrangler.jsonc`.
- `npm run deploy`: only when I ask.
- `gh issue view <n> --comments`: read an issue and its discussion before planning. `gh` also posts the plan comment and opens the PR.

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
- **Mockups:** many differences from the mockups are on purpose. Before "fixing" one, check `docs/design-plan.md` and the "Differences from the mockups" lists in `docs/build-plan.md`.
- **Scope:** don't add dependencies, features or screens that aren't in the docs without asking.

## How to work

Work comes as GitHub issues. `docs/build-plan.md`, "How we work", describes the loop from my side; these are your steps.

1. **Start from the issue.** I say "Work on issue #N." Read it with its comments (`gh issue view N --comments`), then what it names: the sections of `docs/design-plan.md`, the mockup pages, `src/styles/tokens.css` for anything visual, and the entry in `docs/build-plan.md` for the phase that built that screen.
2. **Follow its type** (its label):
   - **bug:** the app doesn't do what the plan says. Don't change the plan; fix the code with a test that would have caught the bug, where a test can. If the plan turns out to be unclear, make it clear in the same PR.
   - **change:** update `docs/design-plan.md` and the tests first, then the code, in one PR.
   - **feature:** the first commit edits only `docs/design-plan.md`. Stop there and wait for my OK before writing code.
   - **chore:** setup, operations or docs. Write steps done by hand as a checklist for me, as in `docs/setup.md`.

   If the label looks wrong, say so before planning.
3. **Plan first.** Propose a short plan: the files, the tests, and any questions. Post it on the issue as a comment too, so a later session can find it. Wait for my OK before writing code.
4. **Small steps.** One branch per issue, named after the change (`fix-zoom-close-ios`), not the issue number. One commit per step, each with its tests. Run typecheck, lint and tests before calling anything done.
5. **Check the UI by looking at it.** Run the app, take screenshots at 390 px and 1440 px, and compare them with the mockups the issue names. A difference that `docs/design-plan.md` records, or that a "Differences from the mockups" list in `docs/build-plan.md` names, is on purpose. List any new differences you couldn't fix.
6. **Finish with a PR.** Fill in the template: `Closes #N`, the plan sections changed, new differences from the mockups, and what to try on my phone. Don't edit `docs/build-plan.md` for a single issue; it's written when a milestone closes. Update this file if a command, a step or a rule that's easy to get wrong changed. Deploy only when I ask.
7. **Ask, don't guess.** If a rule seems wrong or conflicts with the design, ask.
