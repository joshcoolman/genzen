Next.js App Router (React 19 + Turbopack), Supabase, FAL AI (image gen), Tailwind v4, shadcn/ui

## Commands

- `pnpm check` -- prettier + eslint fix (run before commit)
- `pnpm build` -- production build (run after check, before commit)
- `pnpm test` -- vitest
- `npx shadcn@latest add <component>` -- add UI components

## Structure

- `app/` -- App Router routes (`_actions/ _components/` per route folder)
- `src/features/` -- domain modules, **each has its own CLAUDE.md -- read it before working on a feature**
- `src/lib/server/` -- server-only code uses `.server.ts` suffix
- `src/components/` -- shared components + `ui/` (shadcn)
- `supabase/migrations/` -- Postgres migrations (timestamp-prefixed)

## Services

Local dev is one command: **`pnpm local:up`** (MinIO + the Supabase CLI stack +
schema + a populated `.env.local`), then `pnpm dev`. It is idempotent and never
resets a database you have been working in. The only key a human supplies is
`FAL_KEY`; everything else is a container or a fixed local value. See the
README's Local Dev section.

Assume server-side access to the services below unless a feature explicitly says
otherwise. Don't propose new auth/env plumbing for these. Note that locally the
optional keys (Anthropic, Google) are usually **empty** — the app
runs fine without them, so a feature that needs one should fail loudly rather
than assume it's there.

- **Anthropic** (`ANTHROPIC_API_KEY`) — Claude. Server-side AND browser-stored BYOK for the AD panel (`useAnthropicKey`); either path is available.
- **Google Gemini** (`GOOGLE_GENERATIVE_AI_API_KEY`) — vision only (Describe/Caption/shot lists) via `@ai-sdk/google`. There is no Google image-generation path; FAL is the only image provider.
- **FAL AI** (`FAL_KEY`) — image generation via `@fal-ai/client`.
- **Postgres** (`DATABASE_URL`) — the database, reached only through `sql` from `src/lib/server/db.server.ts`. There is no ORM and no query builder; server code writes SQL. There is also no RLS: `sql` connects as the owning role, so **every read and write carries an explicit `user_id` filter**, taken from `resolveAuth()` and never from the caller. Supabase no longer serves any query (#172); what remains of it is the generated types and the old migrations, which #176 removes.
- **S3 storage** (`R2_*`, `VITE_R2_PUBLIC_URL`) — image/asset storage. Public URLs are persistent (no expiry). The `R2_` prefix is historical: `src/lib/image-storage.ts` is a generic S3 client pointed by `R2_ENDPOINT` — MinIO locally, Cloudflare R2 in prod (derived from `R2_ACCOUNT_ID` when `R2_ENDPOINT` is unset).

## Features

| Feature     | Description                                                    | CLAUDE.md                            |
| ----------- | -------------------------------------------------------------- | ------------------------------------ |
| activity    | Chronological cost/time log of every generation (inc failures) | `src/features/activity/CLAUDE.md`    |
| auth        | Password verification + signed session cookie (#168 target)    | `src/features/auth/CLAUDE.md`        |
| ad          | AI chat assistant sidebar with vision + tool calling           | `src/features/ad/CLAUDE.md`          |
| ai-images   | Multi-model image generation, edit, variation workflows        | `src/features/ai-images/CLAUDE.md`   |
| canvas      | Image canvas editor                                            | `src/features/canvas/CLAUDE.md`      |
| spotlight   | Spotlight search / command palette                             | `src/features/spotlight/CLAUDE.md`   |
| status-bar  | Bottom status bar with AD (chat) toggle                        | `src/features/status-bar/CLAUDE.md`  |
| trash       | Soft-deleted item recovery                                     | `src/features/trash/CLAUDE.md`       |
| user-images | User image uploads, library, and asset management              | `src/features/user-images/CLAUDE.md` |

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

`docs/` is small on purpose: `SPEC.md` (what the app does and must do) and
`reference/` (prompt-craft material, the generation presentation contract,
framework notes). Never a plan. There is no in-app docs viewer — that route and
`src/lib/docs/` were deleted; `docs/` is plain repo files, not bundled content.

## Project standard

`~/repos/project-standard/README.md` is the house standard for this project's
conventions — folder layout, component organization, styling, docs shape, naming.

The conformance pass is tracked as an epic (#187). Where the standard applies,
prefer it over an older pattern found in the codebase — an existing file is not
evidence of the current convention.

**Three deliberate exceptions, settled — do not re-litigate them or "fix" the
code toward the standard:**

- **Commit straight to `main`** (see Git workflow above).
- **Server code lives in `src/features/<domain>/server/`**, not in each route's
  `_queries/`/`_actions/`. The standard's route shape assumes reads and writes
  belong to one route; here the same generation, image and trash code is reached
  from AI Images, Canvas and the edit page alike, so splitting it per-route would
  fight how the app actually works. Routes keep `page.tsx` + `_components/`.
- **No resume/continuation files** — they existed, and were removed on purpose.

The standard itself is not changed by any of this; these are genzen's deltas, and
they belong in `docs/CODE-STANDARDS.md` (#180).

## Gotchas

- Route protection is deny-by-default in `proxy.ts`; a new public path must be
  added to its `PUBLIC_PATHS`, or it redirects to /login
- Tailwind v4 config is CSS-based in `src/styles.css` -- there is no `tailwind.config` file
- FAL generation uses on-demand polling via `src/lib/server/check-pending-generations.server.ts`
- Supabase edge functions don't work for us -- use route handlers in `app/api/` instead
