TanStack Start (React 19 + Vite + Nitro SSR), Supabase, FAL AI (image gen), Tailwind v4, shadcn/ui

## Commands

- `pnpm check` -- prettier + eslint fix (run before commit)
- `pnpm build` -- production build (run after check, before commit)
- `pnpm test` -- vitest
- `npx shadcn@latest add <component>` -- add UI components

## Structure

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
- **Supabase** (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_*`) — auth, Postgres, RLS. Anon key client-side, service role server-side only.
- **S3 storage** (`R2_*`, `VITE_R2_PUBLIC_URL`) — image/asset storage. Public URLs are persistent (no expiry). The `R2_` prefix is historical: `src/lib/image-storage.ts` is a generic S3 client pointed by `R2_ENDPOINT` — MinIO locally, Cloudflare R2 in prod (derived from `R2_ACCOUNT_ID` when `R2_ENDPOINT` is unset).

## Features

| Feature     | Description                                                    | CLAUDE.md                            |
| ----------- | -------------------------------------------------------------- | ------------------------------------ |
| activity    | Chronological cost/time log of every generation (inc failures) | `src/features/activity/CLAUDE.md`    |
| ad          | AI chat assistant sidebar with vision + tool calling           | `src/features/ad/CLAUDE.md`          |
| ai-images   | Multi-model image generation, edit, variation workflows        | `src/features/ai-images/CLAUDE.md`   |
| api-keys    | Personal API key management for MCP access                     | `src/features/api-keys/CLAUDE.md`    |
| canvas      | Image canvas editor                                            | `src/features/canvas/CLAUDE.md`      |
| docs        | Internal docs route                                            | `src/features/docs/CLAUDE.md`        |
| mcp         | MCP server for external Claude clients via API keys            | `src/features/mcp/CLAUDE.md`         |
| spotlight   | Spotlight search / command palette                             | `src/features/spotlight/CLAUDE.md`   |
| status-bar  | Bottom status bar with AD (chat) toggle                        | `src/features/status-bar/CLAUDE.md`  |
| trash       | Soft-deleted item recovery                                     | `src/features/trash/CLAUDE.md`       |
| user-images | User image uploads, library, and asset management              | `src/features/user-images/CLAUDE.md` |

## Git workflow

This is a solo project. **Commit directly to main by default.** Feature branches are only justified for genuinely risky or experimental work where an escape hatch is needed.

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

`docs/` holds only what the project is and why (`reference/`, contracts). Never a
plan.

## Project standard

`~/repos/project-standard/README.md` is the house standard for this project's
conventions — folder layout, component organization, styling, docs shape, naming.

**The plan is: move to Next (#168) first, then conform to the standard as closely
as we can.** It is written for Next.js, so the `app/` router half — route folders,
`_actions/ _queries/ _components/`, one-folder-per-component, CSS Modules over
Tailwind — lands in that second pass, not before. The parts that are already
framework-independent (docs shape, issues-not-plan-files, README `## Status`,
`CLAUDE.md` as a boundary contract, naming) apply now.

Where the standard applies, prefer it over an older pattern found in the codebase —
an existing file is not evidence of the current convention. Two deliberate local
exceptions: commit to `main` (see Git workflow above), and resume/continuation
files stay gone rather than being replaced.

## Gotchas

- `routeTree.gen.ts` is auto-generated -- never edit manually
- Tailwind v4 config is CSS-based in `src/styles.css` -- there is no `tailwind.config` file
- FAL generation uses on-demand polling via `src/lib/server/check-pending-generations.server.ts`
- Supabase edge functions don't work for us -- use Nitro h3 routes in `server/api/` instead
