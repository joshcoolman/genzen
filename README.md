# GenZen

A personal workspace for working with AI image models. Fan one prompt across
several models and compare side by side, run non-destructive edit / variation
flows that track parent→child genealogy, arrange results on an infinite canvas,
and ask an in-app assistant about your library.

This is a tool I built for myself and use. It is public because there's no reason
for it not to be — not because it's a product. There's no signup, no billing, no
support, no roadmap. MIT licensed; fork it and make it yours.

## Run it locally

You need Docker, pnpm, and **one real API key: `FAL_KEY`**. No cloud account is
required anywhere — Postgres, auth and storage all run as local containers.

```bash
pnpm install
pnpm local:up                  # asks for your FAL key, sets up everything else
pnpm dev                       # http://localhost:3000
```

That is the whole setup. There is no env file to copy or edit: `local:up` starts
MinIO (S3-compatible storage) from `docker-compose.yml` and the Supabase CLI
stack, writes `.env.local` for you, applies migrations and the seed on a fresh
database, and prompts for the FAL key. Re-run it any time; it is idempotent, it
keeps your key, and it will not reset a database you have been working in (use
`pnpm local:up --reset` for that).

| Thing           | Where                                               |
| --------------- | --------------------------------------------------- |
| App             | http://localhost:3000                               |
| Sign in as      | `testuser@gmail.com` / `supa!1QAwsEDrf`             |
| MinIO console   | http://localhost:9011 (`genzenlocal`/`genzenlocal`) |
| Supabase Studio | http://localhost:54323                              |

FAL is not mocked — generation calls fal.ai for real and costs real money. The
app boots and everything else works without a key. Every generation's cost lands
in the Activity log.

Ports: MinIO is on 9010/9011 rather than its default 9000/9001, so this stack
can run alongside `~/repos/bootsy`.

If a shell-exported `FAL_KEY` shadows the one in `.env.local`, `local:up` warns
about it — that's the usual reason generation 401s.

## Scripts

| Command                             | Purpose                                     |
| ----------------------------------- | ------------------------------------------- |
| `pnpm local:up`                     | Start the local stack, write `.env.local`   |
| `pnpm local:down`                   | Stop it (data kept)                         |
| `pnpm local:reset`                  | Stop it and delete the volumes              |
| `pnpm dev`                          | Vite dev server on :3000                    |
| `pnpm build`                        | Production build                            |
| `pnpm test`                         | Vitest                                      |
| `pnpm check`                        | Prettier + ESLint --fix (run before commit) |
| `npx shadcn@latest add <component>` | Add a shadcn component                      |

## Stack

| Layer       | Tech                                                       |
| ----------- | ---------------------------------------------------------- |
| App         | TanStack Start (React 19 + Vite + Nitro SSR)               |
| UI          | Tailwind v4 (CSS config in `src/styles.css`) + shadcn/ui   |
| Data / auth | Supabase (Postgres + RLS)                                  |
| Storage     | S3 — MinIO locally, Cloudflare R2 in prod                  |
| Images      | FAL                                                        |
| Text/vision | Anthropic (assistant, prompt work), Google Gemini (vision) |

## Repo map

| Path                   | What's there                                                                           |
| ---------------------- | -------------------------------------------------------------------------------------- |
| `src/features/<name>/` | Domain modules. **Each has its own `CLAUDE.md` — read it before editing the feature.** |
| `src/lib/server/`      | Server-only helpers (files use `.server.ts` suffix).                                   |
| `src/components/`      | Shared components, plus `ui/` for shadcn primitives.                                   |
| `server/api/`          | Nitro h3 routes (e.g. `server/api/fal-webhook.post.ts`).                               |
| `supabase/migrations/` | Timestamp-prefixed Postgres migrations.                                                |
| `CLAUDE.md`            | Feature catalog + service / convention notes.                                          |
| `docs/SPEC.md`         | What the app does and the rules that must hold.                                        |

## Env

**Locally there is nothing to configure.** `pnpm local:up` writes `.env.local`
itself and prompts you for the one value that is actually yours, the FAL key.

`.env.example` is the reference for deploying, split into Required (Supabase,
FAL, an S3 bucket) and Optional (Anthropic, Gemini, FAL webhooks).

One note if you deploy: the `R2_*` names are historical. The storage layer is
plain S3 and points wherever `R2_ENDPOINT` says — MinIO locally, any provider in
production. Leave `R2_ENDPOINT` unset and set `R2_ACCOUNT_ID` to derive
Cloudflare R2's endpoint.

Service-role and provider keys are server-only. Anything prefixed `VITE_` ships
to the browser.

## Conventions / gotchas

- `src/routeTree.gen.ts` is autogenerated by TanStack Router — never edit by hand.
- Tailwind v4 has no `tailwind.config.*`; theme lives in `src/styles.css`.
- Server-only code uses the `.server.ts` suffix; do not import it from client code.
- Supabase Edge Functions are not used here — write Nitro h3 routes in `server/api/` instead.
- FAL generation status is reconciled via on-demand polling in `src/lib/server/check-pending-generations.server.ts`. Webhooks are optional and gated by env.
- S3 public URLs do not expire — safe to persist in DB rows.
- Every generate path reserves its `user_images` row _before_ any fallible work,
  so a click always leaves a card behind — pending, completed, or failed with a
  reason and a Retry.

## Status

Orientation lives here and in open issues — there is no continuation or plan file.
Conventions follow `~/repos/project-standard`.

**Last shipped** (2026-07-25)

- **45 migrations collapsed into one baseline** (`20260725100000_baseline.sql`),
  generated from the live database and verified structurally against it. Three
  tables: `user_images`, `user_profiles`, `fal_price_cache`.
- **Stripped the app back to its core before the Next migration.** Removed the MCP
  server and the API-keys feature it existed for (the app's only API-key auth path
  — cookie sessions are now the single auth model), the docs viewer, the legal
  pages, and ~18 files of confirmed-dead code.
- Failures are visible: `MissingKeyDialog` + `useReportError()` surface a missing
  provider key instead of a dead click; Enhance now exists on the edit page.
- `pnpm typecheck` added (`tsc --noEmit`) — `pnpm build` is Vite and does not
  typecheck, so errors had been accumulating unseen. Run it with check/test/build.
- `pnpm local:up` prompts for the keys still missing, preflights the Supabase CLI,
  and finishes by opening a running app.
- No marketing homepage: `/` redirects to `/dashboard` or `/login`.
- Retired the `continue/` resume-pointer system, its git/PreToolUse hooks, the
  `ideas/` capture folder, `docs/plans/`, and the unused `.agents/` skills.

**Up next**

- **#168 — leave Supabase for Postgres + S3 + Node, on Next.** The only open issue.
  Rescoped against `main`, ready to start; `~/repos/bootsy` is the reference
  implementation. Suggested entry point: schema + auth together.
- Then a second pass to conform to `project-standard`'s `app/` conventions —
  route folders, one-folder-per-component, CSS Modules over Tailwind.

The app is now six surfaces and nothing else: AI Images, Canvas, Activity, Trash,
Settings, Account — plus the AD assistant panel. If something does not serve
generating and keeping images, it was cut on purpose.
