Next.js App Router (React 19 + Turbopack), Postgres, FAL AI (image gen), CSS Modules + Base UI (no Tailwind, no CSS framework)

## Commands

- `pnpm check` -- prettier + eslint fix (run before commit)
- `pnpm build` -- production build (run after check, before commit)
- `pnpm test` -- vitest

## Structure

- `app/` -- App Router routes (`_actions/ _components/` per route folder).
  `(authenticated)/` is a route group: a layout boundary that contributes
  nothing to the URL, so `/images`, `/canvas` etc. are top-level paths.
  It is not the gate -- `proxy.ts` is
- `src/features/` -- headless domain modules, **each has its own CLAUDE.md -- read it before working on a feature**
- `src/lib/server/` -- server-only code uses `.server.ts` suffix
- `src/components/` -- primitives, one folder per component, imported from the
  single root barrel `#/components`. Hand-rolled or on Base UI; there is no
  shadcn set left, no `ui/` folder, and no Radix
- `migrations/` -- numbered SQL migrations, applied by `pnpm db:migrate`

## Services

Local dev is one command: **`pnpm local:up`** (Postgres + MinIO + schema + a
populated `.env.local`), then `pnpm dev`. Docker and pnpm are the only
prerequisites. It is idempotent and never resets a database you have been
working in. The only keys a human supplies are `FAL_KEY` and, if the AI-assisted
features are wanted, `ANTHROPIC_API_KEY` -- `local:up` prompts for each that is
missing and the app runs without the second. Everything else is a
container or a fixed local value. See the README's Local Dev section.

Assume server-side access to the services below unless a feature explicitly says
otherwise. Don't propose new auth/env plumbing for these. Note that locally the
optional keys (Anthropic, Google) are usually **empty** — the app
runs fine without them, so a feature that needs one should fail loudly rather
than assume it's there.

- **Anthropic** (`ANTHROPIC_API_KEY`) — Claude, server-side only. Prompt enhancement and variation prompts; there is no browser-held key.
- **Google Gemini** (`GOOGLE_GENERATIVE_AI_API_KEY`) — vision only (Describe/Caption/shot lists) via `@ai-sdk/google`. There is no Google image-generation path; FAL is the only image provider.
- **FAL AI** (`FAL_KEY`) — image generation via `@fal-ai/client`.
- **Postgres** (`DATABASE_URL`) — the database, reached only through `sql` from `src/lib/server/db.server.ts`. There is no ORM and no query builder; server code writes SQL. There is also no RLS: `sql` connects as the owning role, so **every read and write carries an explicit `user_id` filter**, taken from `resolveAuth()` and never from the caller. That is checked, not remembered: `eslint-rules/sql-user-scoping.js` fails any `sql` statement naming a user-scoped table without one (#219). The tables come from the migrations, so a new one is covered the day it lands. Where an id is genuinely server-derived, annotate the statement `// sql-scope-exempt: <why>` — a reason is required, and `grep sql-scope-exempt` is the list of every place the rule is knowingly bent. Row shapes are `src/lib/types/db.ts`, paired with the select list in `src/lib/server/user-image-columns.server.ts` — a test fails if either drifts from `migrations/0001_init.sql`.
- **S3 storage** (`R2_*`) — image/asset storage. `src/lib/image-storage.ts` is a
  provider-agnostic S3 client pointed by `R2_ENDPOINT`; the `R2_` prefix is
  historical and Cloudflare-specific plumbing (`R2_ACCOUNT_ID`) is a leftover of
  it. **MinIO in Docker is the only place genzen has ever run.** There is no
  production deployment and no storage provider chosen — if a doc, a comment or
  a memory says R2 is in production, it is wrong (#225).
  **The bucket is private** (#226), locally too. Nothing reads an object without
  credentials: the browser gets images from `/img/[id]`, which resolves identity
  from the cookie and filters the row by `user_id`. `src/lib/image-url.ts` is the
  only place a URL is built — two surfaces used to concatenate one by hand, so a
  change to the scheme silently missed them. Server code that needs bytes
  (FAL uploads, vision) calls `storage.download()` and never HTTP.

## Features

**`src/features/` — domain code two or more routes need.** A folder here is
earned; see `docs/DELTAS.md`.

| Feature     | Description                                                    | CLAUDE.md                            |
| ----------- | -------------------------------------------------------------- | ------------------------------------ |
| activity    | Chronological cost/time log of every generation (inc failures) | `src/features/activity/CLAUDE.md`    |
| ai-images   | Multi-model image generation, edit, variation workflows        | `src/features/ai-images/CLAUDE.md`   |
| auth        | Password verification + signed session cookie                  | `src/features/auth/CLAUDE.md`        |
| user-images | User image uploads, library, and asset management              | `src/features/user-images/CLAUDE.md` |

**Route-owned surfaces** — these had a `features/` folder until #181 and now
live with the one route that renders them:

| Surface    | Where                                                                                   |
| ---------- | --------------------------------------------------------------------------------------- |
| Canvas     | `app/(authenticated)/canvas/` (has its CLAUDE.md)                                       |
| Images     | `app/(authenticated)/images/` (has its CLAUDE.md)                                       |
| Trash      | `app/(authenticated)/trash/` (has its CLAUDE.md)                                        |
| App chrome | `app/(authenticated)/_components/` — shell, chrome, sidebar, mobile nav, search overlay |
| Readme     | `app/(authenticated)/readme/` — renders README.md at /readme, nothing else              |

`(authenticated)/_components/` also holds the generation UI Images and Canvas
share (`generator-panel/` and what it composes). Anything one route renders
lives with that route — #189 moved six folders out of there on that rule.

## Git workflow

**Branch, PR, merge — the house standard, as of 2026-07-31.** Cut a short
kebab-case branch, do the work, open a PR, merge it. This repo ran on
commit-straight-to-`main` through the structural conversion (#168 → #229), which
was the right call for a long run of mechanical passes and is no longer the
shape of the work.

**One issue per branch.** Finish the ticket, close the issue, PR, merge, delete
the branch local and remote, then cut the next one. A branch covering two issues
is allowed but is not the habit. The PR is not a review gate — there is no
reviewer — so open it and merge it in the same breath; do not wait to be told.
The value is the buckets: the branch name and the PR are what say _what this
work was_ when you come back to it, and what stop everything blurring into one
`main` history.

**A branch may outlive a session — that is part of what it is for.** Work that
runs over a day or two keeps its own branch, and the branch name plus the PR are
the orientation surface when you come back: where you were, and what is done so
far. Do not rush a merge to close the day.

**The rule that does not relax: push the branch.** Never leave it local-only.
Three Macs pull from this remote, and work that exists on one machine's disk is
work the next machine cannot see — that is the actual failure behind the June
2026 tangle, where a branch was cut off a stale `main` and reproduced work that
already existed. Pushing fixes it; merging early is not required.

Before assuming `main` is behind, check `git diff origin/main` rather than
`git log origin/main..HEAD` — a squash merge makes a fully-landed branch look
unmerged while every line is identical.

At the end of any session:

- Everything **finished** is merged to `main` and pushed
- Everything **in progress** is committed and pushed on its branch
- No work exists only on one machine's disk
- Branches for work that is genuinely done are deleted

Trivial exceptions that stay direct-to-`main`: a README `## Status` touch-up, or
a one-line fix to something already merged.

## Orientation and capture

Two durable surfaces, no continuation file: the README `## Status` block (last
shipped / up next) and open GitHub issues. Read both at session start.

**Capture to GitHub issues, not the filesystem.** Anything worth carrying past
this session — a plan, a task, a bug, an idea from a poke-around session ("capture
this") — becomes an issue. Do not create plan files, handoff docs, an `ideas/`
folder, or a `continue/` directory; all of those existed and were removed
deliberately. Update the README `## Status` block at natural beats so the front
door always reflects the current state.

`docs/` is small on purpose: `OVERVIEW.md` (what genzen is), `SPEC.md` (what it
does and must do), `DELTAS.md` (the deltas from the house standard) and
`reference/` (two files: the generation presentation contract and genzen's route
evidence). Never a plan, and never research — `docs/` describes the app as it
is, and anything that does not is deleted rather than parked. There is no
in-app docs viewer — that route and
`src/lib/docs/` were deleted; `docs/` is plain repo files, not bundled content.

## Project standard

[project-standard](https://github.com/joshcoolman/project-standard) is the house
standard — folder layout, component organization, styling, docs shape, naming.
Follow it as closely as this repo can.

**`docs/DELTAS.md` holds what genzen decides differently, and nothing else.**
Read that file rather than re-deriving them; it is the only place they live.
The two that come up constantly:

- **`features/` is headless and earned by 2+ consumers.** No `.tsx` under
  `src/features/`. One consumer means it belongs to that route.
- **Server-only code carries a `.server.ts` suffix.**

Where the standard applies, prefer it over an older pattern found in the
codebase — an existing file is not evidence of the current convention, because
the conformance pass (#187) is still in flight.

**How a route is built:** the shape lives in the house standard
(`project-standard`, "Route shape") — `page.tsx` renders `view.tsx`, which
composes components and carries no styles; `use-view.ts` holds the state.
`docs/reference/route-shape.md` keeps only genzen's own evidence and its
primitives catalogue.

Copy `app/(authenticated)/trash/` for a simple route or `canvas/` for one with
real state; not Activity, which established the shape but still fetches from the
client. Every route conforms except `readme/`, which is a page and a
stylesheet: it renders one file and has no state, so `view.tsx` and
`use-view.ts` would both be empty indirection. Named here rather than left as a
silent exception, because the value of "copy a neighbour" is that it is safe.

## Gotchas

- Route protection is deny-by-default in `proxy.ts`; a new public path must be
  added to its `PUBLIC_PATHS`, or it redirects to /login
- There is no Tailwind and no CSS framework (#186). `src/styles/tokens.css` is the token layer, `src/styles/base.css` the reset, and every component has a `.module.css` beside it. `src/styles.css` imports those two and nothing else. Reach for `cx` from `#/lib/utils` to join module classes -- `cn`/`tailwind-merge` are gone
- FAL generation uses on-demand polling via `src/lib/server/check-pending-generations.server.ts`
- **Copying an image inside the app puts its record id on the clipboard, never
  its bytes** (`src/lib/image-clipboard.ts`, #213). Both paste handlers accept
  bytes and turn them into a new upload, so bytes would duplicate a row you
  already own. A new paste target checks `readImageRef` before it looks for files
- **A global overlay must take the keyboard, not share it**
  (`src/lib/keyboard-capture.ts`). Canvas replaces hotkeys-js's default
  text-field exemption with its own dialog check, so anything floating over a
  route sets the capture flag or Backspace in its input reaches the canvas
