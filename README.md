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
Postgres and MinIO (S3-compatible storage) from `docker-compose.yml`, the Supabase CLI
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
| Postgres        | `postgres://genzen:genzen@localhost:5434/genzen`    |

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
| `pnpm dev`                          | Next dev server on :3000                    |
| `pnpm build`                        | Production build                            |
| `pnpm test`                         | Vitest                                      |
| `pnpm check`                        | Prettier + ESLint --fix (run before commit) |
| `pnpm typecheck`                    | `tsc --noEmit` (the build typechecks too)   |
| `pnpm db:migrate`                   | Apply pending `migrations/*.sql`            |
| `pnpm auth:create-user`             | Create a user, or reset one's password      |
| `npx shadcn@latest add <component>` | Add a shadcn component                      |

## Stack

| Layer       | Tech                                                       |
| ----------- | ---------------------------------------------------------- |
| App         | Next.js App Router (React 19 + Turbopack)                  |
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
| `app/api/`             | Route handlers (e.g. `app/api/fal-webhook/route.ts`).                                  |
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

- Route protection is deny-by-default in `proxy.ts` — a new public path must be listed in its `PUBLIC_PATHS`.
- Tailwind v4 has no `tailwind.config.*`; theme lives in `src/styles.css`.
- Server-only code uses the `.server.ts` suffix; do not import it from client code.
- Supabase Edge Functions are not used here — write route handlers in `app/api/` instead.
- FAL generation status is reconciled via on-demand polling in `src/lib/server/check-pending-generations.server.ts`. Webhooks are optional and gated by env.
- S3 public URLs do not expire — safe to persist in DB rows.
- Every generate path reserves its `user_images` row _before_ any fallible work,
  so a click always leaves a card behind — pending, completed, or failed with a
  reason and a Retry.

## Status

Orientation lives here and in open issues — there is no continuation or plan file.
Conventions follow `~/repos/project-standard`.

**Last shipped** (2026-07-27)

- **Nothing talks to Supabase any more (#172 done).** All 100 remaining
  `.from()` calls became SQL through `src/lib/server/db.server.ts`, and the
  admin client is deleted. Three "read the whole table and BFS it in JS" walks
  became recursive CTEs; `resolveAuth()` returns an id and nothing else, so a
  query has to name `user_id` itself. Two things the conversion turned up: the
  planned `postgres.camel` transform would have silently camel-cased the keys
  *inside* `generation_metadata`, and a row naming itself as its own
  `parent_id` makes a naive recursive CTE run forever — both are handled and
  commented where they bite.
- **The browser cannot reach the database at all (#173 done).** The last 19
  queries — Canvas, the edit page, generation results, Activity — became
  `canvas/server/canvas.actions.ts` and `ai-images/server/edit.actions.ts`, and
  `src/lib/supabase.ts` is deleted. The anon key is no longer inlined into the
  bundle; `VITE_SUPABASE_URL` is server-only. Two tree walks moved with the
  queries: both used to pull every one of the user's rows into the browser to
  find a handful of descendants.
- **Nothing pushes any more, anywhere (#174 done).** The last three realtime
  channels (`use-edit-children`, `useGenerationResults`, `use-activity-page`)
  are gone. A submit refreshes once; each poll that settles a row refreshes
  again; the edit page's nested children re-read when the gallery's poll picks
  up a newly completed row.
- **Trash is off the browser database client (#173), and can no longer strand a
  row (#177).** Permanent delete moved server-side whole — the link check that
  decides whether a delete is allowed used to run in the browser, so a client
  that skipped it deleted whatever it liked. Soft-deleting now also clears
  `on_canvas`, which is what left an image undeletable in Trash and invisible on
  Canvas at the same time.
- **A failed generation is no longer treated as worth keeping.** Retry reuses the
  failed row instead of spawning a second card; deleting a failure destroys it
  rather than filling Trash with unrestorable rows; and a failure finally gets a
  title, so a failed card stops reading "Generating..." forever.
- **AI Images is off the browser database client (#173).** Its 14 queries became
  `ai-images/server/gallery.actions.ts`, user-scoped by `resolveAuth()`. The
  cascading delete moved server-side wholesale — it was four browser round trips
  reading each other's results.
- **The app runs on Next (#175).** TanStack Start, Router, Vite and Nitro are
  gone — 15 file routes became `app/` route folders, 20 `createServerFn`
  definitions became server actions, and the FAL webhook became a route handler.

**Up next**

- **Signing in gives you an empty library today.** Login verifies against the new
  `users` table, whose ids are freshly generated, while `user_images.user_id`
  still holds Supabase auth uuids. Provision the local user with the matching
  uuid, or move the data, before expecting to see anything.
- **#176 — delete Supabase.** Nothing queries it now; the package, the generated
  types in `src/lib/types/supabase.ts` and the old `supabase/migrations/` are
  all that is left of it in #168.
- Then the `project-standard` conformance pass: one-folder-per-component and
  CSS Modules over Tailwind.

The app is now six surfaces and nothing else: AI Images, Canvas, Activity, Trash,
Settings, Account — plus the AD assistant panel. If something does not serve
generating and keeping images, it was cut on purpose.
