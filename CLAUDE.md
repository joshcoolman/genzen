Next.js App Router (React 19 + Turbopack), Postgres, FAL AI (image gen), Tailwind v4, shadcn/ui

## Commands

- `pnpm check` -- prettier + eslint fix (run before commit)
- `pnpm build` -- production build (run after check, before commit)
- `pnpm test` -- vitest
- `npx shadcn@latest add <component>` -- add UI components

## Structure

- `app/` -- App Router routes (`_actions/ _components/` per route folder).
  `(authenticated)/` is a route group: a layout boundary that contributes
  nothing to the URL, so `/images`, `/canvas` etc. are top-level paths.
  It is not the gate -- `proxy.ts` is
- `src/features/` -- headless domain modules, **each has its own CLAUDE.md -- read it before working on a feature**
- `src/lib/server/` -- server-only code uses `.server.ts` suffix
- `src/components/` -- primitives, one folder per component, imported from the
  single root barrel `#/components` (which also re-exports `ui/`, the shadcn set)
- `migrations/` -- numbered SQL migrations, applied by `pnpm db:migrate`

## Services

Local dev is one command: **`pnpm local:up`** (Postgres + MinIO + schema + a
populated `.env.local`), then `pnpm dev`. Docker and pnpm are the only
prerequisites. It is idempotent and never resets a database you have been
working in. The only key a human supplies is `FAL_KEY`; everything else is a
container or a fixed local value. See the README's Local Dev section.

Assume server-side access to the services below unless a feature explicitly says
otherwise. Don't propose new auth/env plumbing for these. Note that locally the
optional keys (Anthropic, Google) are usually **empty** — the app
runs fine without them, so a feature that needs one should fail loudly rather
than assume it's there.

- **Anthropic** (`ANTHROPIC_API_KEY`) — Claude. Server-side AND browser-stored BYOK for the AD panel (`useAnthropicKey`); either path is available.
- **Google Gemini** (`GOOGLE_GENERATIVE_AI_API_KEY`) — vision only (Describe/Caption/shot lists) via `@ai-sdk/google`. There is no Google image-generation path; FAL is the only image provider.
- **FAL AI** (`FAL_KEY`) — image generation via `@fal-ai/client`.
- **Postgres** (`DATABASE_URL`) — the database, reached only through `sql` from `src/lib/server/db.server.ts`. There is no ORM and no query builder; server code writes SQL. There is also no RLS: `sql` connects as the owning role, so **every read and write carries an explicit `user_id` filter**, taken from `resolveAuth()` and never from the caller. Row shapes are `src/lib/types/db.ts`, paired with the select list in `src/lib/server/user-image-columns.server.ts` — a test fails if either drifts from `migrations/0001_init.sql`.
- **S3 storage** (`R2_*`, `VITE_R2_PUBLIC_URL`) — image/asset storage. Public URLs are persistent (no expiry). The `R2_` prefix is historical: `src/lib/image-storage.ts` is a generic S3 client pointed by `R2_ENDPOINT` — MinIO locally, Cloudflare R2 in prod (derived from `R2_ACCOUNT_ID` when `R2_ENDPOINT` is unset).

## Features

**`src/features/` — domain code two or more routes need.** A folder here is
earned; see `docs/CODE-STANDARDS.md`.

| Feature     | Description                                                    | CLAUDE.md                            |
| ----------- | -------------------------------------------------------------- | ------------------------------------ |
| activity    | Chronological cost/time log of every generation (inc failures) | `src/features/activity/CLAUDE.md`    |
| ad          | AI chat assistant sidebar with vision + tool calling           | `src/features/ad/CLAUDE.md`          |
| ai-images   | Multi-model image generation, edit, variation workflows        | `src/features/ai-images/CLAUDE.md`   |
| auth        | Password verification + signed session cookie                  | `src/features/auth/CLAUDE.md`        |
| user-images | User image uploads, library, and asset management              | `src/features/user-images/CLAUDE.md` |

**Route-owned surfaces** — these had a `features/` folder until #181 and now
live with the one route that renders them:

| Surface    | Where                                                                                          |
| ---------- | ---------------------------------------------------------------------------------------------- |
| Canvas     | `app/(authenticated)/canvas/` (has its CLAUDE.md)                                              |
| Trash      | `app/(authenticated)/trash/` (has its CLAUDE.md)                                               |
| App chrome | `app/(authenticated)/_components/` — shell, chrome, sidebar, mobile nav, spotlight, status bar |

## Git workflow

**This repo, and this repo alone: commit and push straight to `main`, freely.**
Be aggressive about it — do not stop to ask, do not open a PR, do not cut a
branch for ordinary work. This is a deliberate exception to `project-standard`
("never commit to `main` directly") and to the global `~/.claude/CLAUDE.md` rule
about branching before non-trivial work. Both still hold everywhere else; here
they are overridden. Nothing in this repo needs the exception re-argued.

Feature branches are only justified for genuinely risky or experimental work where an escape hatch is needed.

If a branch is used, merge it and delete it before the session's final commit — never leave branches open at end of session. The goal is that main always reflects the current working state of the app, so switching computers means pulling main and continuing seamlessly.

At the end of any session, main should be:

- Up to date with all completed work
- Pushed to remote
- Free of stale local branches

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
does and must do), `CODE-STANDARDS.md` (the deltas from the house standard) and
`reference/` (prompt-craft material, the generation presentation contract,
framework notes). Never a plan. There is no in-app docs viewer — that route and
`src/lib/docs/` were deleted; `docs/` is plain repo files, not bundled content.

## Project standard

`~/repos/project-standard/README.md` is the house standard — folder layout,
component organization, styling, docs shape, naming.

**`docs/CODE-STANDARDS.md` states genzen's deltas from it, and nothing else.**
Read that file rather than re-deriving them; it is the only place they live.
Two that come up constantly:

- **Commit straight to `main`** (see Git workflow above).
- **`features/` is headless and earned by 2+ consumers.** No `.tsx` under
  `src/features/`. One consumer means it belongs to that route.

Where the standard applies, prefer it over an older pattern found in the
codebase — an existing file is not evidence of the current convention, because
the conformance pass (#187) is still in flight.

## Gotchas

- Route protection is deny-by-default in `proxy.ts`; a new public path must be
  added to its `PUBLIC_PATHS`, or it redirects to /login
- Tailwind v4 config is CSS-based in `src/styles.css` -- there is no `tailwind.config` file
- FAL generation uses on-demand polling via `src/lib/server/check-pending-generations.server.ts`
