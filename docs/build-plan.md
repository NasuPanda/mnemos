# Mnemos — Build Plan

The order we build in. Each phase ends with something you can use on your phone, and each one is small enough to change course after. The product rules live in `docs/design-plan.md`; the look lives in `docs/design/` and `src/styles/tokens.css`.

## How we work

**One phase at a time:**

1. **Start:** I say "Start phase N."
2. **Plan:** the AI reads this file, the plan sections and mockups listed for the phase, and proposes a plan: files, tests, and questions.
3. **Approve:** I approve or adjust the plan.
4. **Build:** the AI builds in small commits.
5. **Check:** it runs typecheck, lint and tests, and compares screenshots at 390 px and 1440 px with the mockups.
6. **Finish:** it ticks the boxes below and tells me what to try on my phone.

**Sessions and branches:** start a fresh AI session for each phase; this file and `docs/design-plan.md` carry the context between sessions. Use one git branch per phase, named after the change it makes rather than the phase number (phase 0 was `scaffold-worker-and-access-login`). Merge when "Done when" is true, and deploy after every phase.

**Tests are written with the code, not at the end:**

- **Core:** unit tests for the scheduling rules.
- **API:** tests with `@cloudflare/vitest-plugin`.
- **End-to-end:** one or two Playwright flows per phase, on a phone-sized and a desktop-sized screen.

## Changing direction

- **Small change** (wording, a rule, a colour): ask for it directly. The AI updates `docs/design-plan.md` and the tests first, then the code, in one commit.
- **Bigger change** (a new feature, a different flow): write it in `docs/design-plan.md` first, or ask the AI to draft the change there for you to review. Then add tasks to the right phase below, or a new phase.
- **Why changes stay cheap:**
  - Rules live only in `src/core`, with tests.
  - Colours, type and spacing live only in the tokens.
  - Each phase is a separate branch that can be reverted.
- **Record decisions:** write every decision that changes the plan in the plan's own text, not only in chat.

---

## Phase 0 — Foundations

**Goal:** prove the risky parts first: deploying, Google login through Access, D1 and R2, and reaching the app from your phone.

**Tasks:**

- [x] Split `docs/design/visual-directions.pdf` into one PNG per page in `docs/design/`, named as in the table at the end of this file.
- [x] Scaffold with `npm create cloudflare@latest -- mnemos --framework=react` (React + Vite + `@cloudflare/vite-plugin`).
- [x] Add a Hono Worker entry (`worker/index.ts`).
- [x] Set up `wrangler.jsonc`:
  - `assets.not_found_handling: "single-page-application"`;
  - `run_worker_first: ["/api/*", "/img/*"]`;
  - D1 and R2 bindings.
- [x] Tailwind CSS v4 (CSS-first, no `tailwind.config.js`), then `shadcn init`.
- [x] Add `src/styles/tokens.css` from the design draft. Add the key-hint colour inside the yellow button (#D0A806) as a token, and remove shadcn's `destructive` variants.
- [x] Fonts: `@fontsource-variable/atkinson-hyperlegible-next` and `-mono`.
- [x] Tooling: strict TypeScript, ESLint and Prettier, Vitest, `@cloudflare/vitest-plugin`, Playwright. Create the npm scripts listed in `AGENTS.md`.
- [x] Drizzle with a first migration (`users` only).
- [x] Identity middleware: check the `Cf-Access-Jwt-Assertion` header with `jose`; locally, use `DEV_USER_EMAIL`.
- [x] `GET /api/me` and a bare page that shows "Signed in as …" on the Dusk background.
- [x] Deploy, then follow the plan's Login setup: Google OAuth client, Access application, 1-month session. **This step is done by hand, and the AI writes the checklist.**
- [x] Optional: a GitHub Actions workflow that runs typecheck, lint and tests on every push (`.github/workflows/ci.yml`, including the end-to-end tests).

**Done when:** the deployed app asks for Google login, then shows your email, read from D1, on both your laptop and your phone. `npm test` passes.

**Done (3 Oct 2026):** live at https://mnemos.mnemos.workers.dev, confirmed on laptop and phone. Decisions recorded in the plan: shadcn on Radix, `kbd-primary` token, the Worker checks the Access JWT itself (`ctx.access` doesn't reach Workers with static assets), and the AUD tag comes from the login redirect when the dashboard field is empty.

## Phase 1 — The scheduling core (no UI)

**Goal:** turn "Scheduling rules" and "Counts" from the plan into tested code. This is the heart of the app and the part you are most likely to tweak later.

**Tasks:**

- [ ] In `src/core`, write pure TypeScript with no React, no database and no clock. "Today" is always passed in as a `YYYY-MM-DD` string. It covers:
  - ladder moves, the next due date, manual dates (after today only), and early and late reviews;
  - once a day;
  - days late, and the order: section order, then most days late first, then the ones due today; equally late items in creation order, oldest first; on a future day, items reviewed today last in their section;
  - the counts: Left, Late, Done, Due, Early and Line.
- [ ] Ladder edits:
  - validation: 1–7 stops, gaps from 1 to 365, each longer than the one before;
  - adding a stop: its gap starts at double the last one, capped at 365; refused at 7 stops or when the last gap is 365;
  - removing stop k: `stop = stop − 1` where `stop ≥ max(k, 2)`.
- [ ] Undo (restore `stop_before` and `was_due_on`; only for a review made today), the section colour counter (M2 → M3 → M4), and section-code suggestion and validation (the suggestion rule is in the plan's Core concepts; any valid code the user types wins).
- [ ] Use the design draft's checked examples as test cases:
  - **A stop-4 item rated on Thu 24 Sep 2026:**
    - Confident → Thu 1 Oct, stop 5;
    - Neutral → Tue 29 Sep, stop 4;
    - Not at all → Fri 25 Sep, stop 1.
  - **An item on the last stop, rated the same day:** Confident or Neutral → Thu 22 Oct, stop 7.
  - **The Dijkstra item's history:** 3 Sep to 16 Sep, including the review on Sat 12 Sep that was 1 day early.
  - **Counts:** 38 left, 7 late and 9 done add up to 47 done. On Friday, 17 due minus 5 reviewed today gives Review early · 12.

**Done when:** every rule in the plan has a test, and the test names read like the rules.

## Phase 2 — Slice 1: today and the review loop

**Goal:** the core loop works end to end with realistic sample data. This is where you find out whether the app feels right on a tram, before anything else is built.

**Tasks:**

- [ ] Database: the full schema from the plan, plus a seed script with sample data like the mockups (12 sections, a few hundred items, some with images).
- [ ] API:
  - load today;
  - save a review;
  - undo;
  - serve images from R2 at `/img/*`.
- [ ] App shell:
  - the sidebar from 1024 px, the tab bar below that;
  - key hints hidden on touch screens.
- [ ] Dashboard (today):
  - the summary line;
  - section cards drawn as metro lines, with each item's stop and overdue delay;
  - Start review.
- [ ] Review mode:
  - the problem side;
  - revealing the answer: tap, click or Space, while images still zoom and links still open;
  - the answer side, with Markdown rendering;
  - problem images as thumbnails after the reveal;
  - the confidence buttons with their date and stop;
  - Pick a date;
  - Undo for 4 s, shown at the top of the screen on phones.
- [ ] Flash review: the start screen and the section-by-section order. All done: Végállomás, using the placeholder art for now.
- [ ] Keyboard: J/K, Enter, Space, 1/2/3, D, Z, U, Esc, F and Shift+F.
- [ ] End-to-end tests:
  - review three items with only the keyboard at 1440 px;
  - review them with taps at 390 × 844 until All done.

**Mockups:** 01, 02, 03, 04, 05, 06, 07, 08, 09, 11–16, 18 and 19, plus 20 (item fields section).

**Done when:** on your phone you can review the seeded day to the Végállomás, ratings survive a reload, and Undo works.

## Phase 3 — Slice 2: items and the editor

**Goal:** you can add real items, including photos from your phone. **From here on, use Mnemos for real.**

**Tasks:**

- [ ] Item editor:
  - every field, with Name and Section required;
  - Markdown fields with a Write / Preview toggle;
  - a Code button on phones that wraps the selection in backticks;
  - Save stays within reach, with Ctrl/⌘+Enter on desktop;
  - Delete asks first.
- [ ] Section picker with "create on the spot": the suggested code and the next colour are shown, and the user can type their own code instead.
- [ ] Images:
  - resize, hash and upload in the browser;
  - paste or drop on desktop; camera or photo library on the phone;
  - reorder with dnd-kit, and remove;
  - reject files over 2 MB.
- [ ] Items list:
  - search names, descriptions and notes (`/` focuses the search box);
  - filter by section and sort by next due;
  - a table on desktop, rows on the phone.
- [ ] **Decide and build:** managing sections (rename, change code, reorder, delete). The draft has no screen for this yet, so the AI should propose one before building it.
- [ ] End-to-end test: create an item with two images on a phone-sized screen, then find it with search.

**Mockups:** 23–29, plus 18 (components).

**Done when:** you add a real item from your phone, including a photo, and review it the same day.

## Phase 4 — Slice 3: other days, history and the ladder

**Goal:** everything around the loop: moving between days, reviewing early, the item history, and the ladder editor.

**Tasks:**

- [ ] Week strip:
  - past days show the reviews done that day;
  - future days show the items due;
  - `[` and `]` move a day, and T jumps to today.
- [ ] Future day:
  - items already reviewed today are dimmed, listed last in their section, and skipped by J/K;
  - Review early, with the Early count.
- [ ] Item history:
  - the line map and the table;
  - picked-date and early-review marks;
  - on the phone, the latest 10 reviews, with scrolling for older ones;
  - the H panel inside review mode.
- [ ] Settings ("Menetrend"):
  - the ladder editor with validation;
  - add stop (its gap starts at double the last one, capped at 365);
  - remove stop, with a confirmation that doesn't act on a plain Enter;
  - the preview of where each rating leads;
  - Account and Sign out (`/cdn-cgi/access/logout`).
- [ ] End-to-end tests: review an item early from Friday's view; remove a stop and check where its items moved.

**Mockups:** 10, 20, 30, 31 and 32.

**Done when:** you can plan around a busy day by reviewing early, and change your ladder without surprises.

## Phase 5 — Rest moments and polish

**Goal:** the Budapest moments, and the finishing touches that make the app feel finished.

**Tasks:**

- [ ] Parliament illustration: generate it using page 21's prompt plus your own photo as a reference. Export WebP/AVIF (2400 × 1600 and 1200 × 800). Add the CSS mask, and load it in advance on the last item.
- [ ] Zsolnay pattern (the Settings band); the app icon and favicon (the yellow M); the flash review doors screen.
- [ ] Access login page: set its name, logo and colours to match the app (Access's own settings).
- [ ] Command menu (Ctrl/⌘+K), the `?` shortcut overlay, and ⌘ instead of Ctrl on Macs.
- [ ] PWA (optional): manifest with `crossorigin="use-credentials"`; install it on your phone.
- [ ] Checks:
  - accessibility: axe, one full keyboard-only run, and a screen-reader spot check;
  - contrast against page 22;
  - bundle size: code highlighting is loaded only when needed.

**Mockups:** 05, 06, 21 and 22.

**Done when:** the app looks like the mockups on both widths, and a keyboard-only run and a phone run have no rough edges.

## Phase 6 — Friends beta

- [ ] Add a few friends' emails to the Access application.
- [ ] Set up the $1 budget alert and a regular D1 backup (`wrangler d1 export`).
- [ ] Collect feedback; update `docs/design-plan.md` and plan the next phase.

## Later

- Math formulas: remark-math + rehype-katex, loaded only for items that use them.
- Light mode: one more block of token values.

---

## Mockup files

The pages of `docs/design/visual-directions.pdf` (round 3), saved as `docs/design/<file>.png`. The PDFs, PNGs and HEIC in `docs/design/` are kept out of git; rebuild the PNGs with `swift scripts/split-mockups.swift docs/design/visual-directions.pdf docs/design` (macOS). Desktop pages come out 1440 px wide and phone pages 390 × 844, the same sizes as the Playwright screenshots.

| Page | File |
| --- | --- |
| 1 | 01-dashboard-today-desktop |
| 2 | 02-review-problem-full-desktop |
| 3 | 03-review-problem-minimal-desktop |
| 4 | 04-flash-start-phone |
| 5 | 05-all-done-phone |
| 6 | 06-all-done-desktop |
| 7 | 07-dashboard-today-phone |
| 8 | 08-review-answer-full-desktop |
| 9 | 09-review-answer-minimal-desktop |
| 10 | 10-future-day-review-early-phone |
| 11 | 11-review-problem-full-phone |
| 12 | 12-review-problem-minimal-phone |
| 13 | 13-review-answer-full-phone |
| 14 | 14-review-answer-minimal-phone |
| 15 | 15-review-answer-scrolled-phone |
| 16 | 16-image-zoom-phone |
| 17 | 17-style-tokens |
| 18 | 18-style-components |
| 19 | 19-style-mnemos-parts |
| 20 | 20-style-history-ladder-fields |
| 21 | 21-style-image-prompts |
| 22 | 22-style-contrast |
| 23 | 23-items-desktop |
| 24 | 24-items-search-phone |
| 25 | 25-item-editor-desktop |
| 26 | 26-section-picker-desktop |
| 27 | 27-item-editor-phone |
| 28 | 28-item-editor-images-phone |
| 29 | 29-section-picker-phone |
| 30 | 30-settings-desktop |
| 31 | 31-settings-phone |
| 32 | 32-remove-stop-phone |
