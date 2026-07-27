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

That is the whole setup, and Docker plus pnpm are the only prerequisites --
there is no global CLI to install and no env file to copy or edit. `local:up`
starts Postgres and MinIO (S3-compatible storage) from `docker-compose.yml`,
writes `.env.local` for you, applies any migrations the database has not seen,
provisions the dev login, and prompts for the FAL key. Re-run it any time: it is
idempotent, it keeps your key, and it never resets a database you have been
working in. `pnpm local:reset` is the deliberate way to start over.

| Thing         | Where                                               |
| ------------- | --------------------------------------------------- |
| App           | http://localhost:3000                               |
| Sign in as    | `testuser@gmail.com` / `supa!1QAwsEDrf`             |
| MinIO console | http://localhost:9011 (`genzenlocal`/`genzenlocal`) |
| Postgres      | `postgres://genzen:genzen@localhost:5434/genzen`    |

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
| Data        | Postgres, queried with SQL via `postgres` (no ORM)         |
| Auth        | scrypt + signed session cookie, own `users` table          |
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
| `migrations/`          | Numbered SQL migrations, applied by `pnpm db:migrate`.                                 |
| `CLAUDE.md`            | Feature catalog + service / convention notes.                                          |
| `docs/SPEC.md`         | What the app does and the rules that must hold.                                        |

## Env

**Locally there is nothing to configure.** `pnpm local:up` writes `.env.local`
itself and prompts you for the one value that is actually yours, the FAL key.

`.env.example` is the reference for deploying, split into Required (a Postgres
URL, a session secret, FAL, an S3 bucket) and Optional (Anthropic, Gemini, FAL
webhooks).

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
- FAL generation status is reconciled via on-demand polling in `src/lib/server/check-pending-generations.server.ts`. Webhooks are optional and gated by env.
- S3 public URLs do not expire — safe to persist in DB rows.
- Every generate path reserves its `user_images` row _before_ any fallible work,
  so a click always leaves a card behind — pending, completed, or failed with a
  reason and a Retry.

## Status

Orientation lives here and in open issues — there is no continuation or plan file.
Conventions follow `~/repos/project-standard`.

**Last shipped** (2026-07-27)

- **Supabase is gone (#176 done, closing #168).** The package, the generated
  types and `supabase/` are deleted, and `local:up` sheds the CLI stack — Docker
  and pnpm are now the only prerequisites for a local checkout. `UserImageRow`
  in `src/lib/types/db.ts` replaces the generated types by hand, and a test
  fails if it, the select list in `user-image-columns.server.ts` and the table
  in `migrations/0001_init.sql` ever disagree.
- **Nothing talks to Supabase any more (#172 done).** All 100 remaining
  `.from()` calls became SQL through `src/lib/server/db.server.ts`, and the
  admin client is deleted. Three "read the whole table and BFS it in JS" walks
  became recursive CTEs; `resolveAuth()` returns an id and nothing else, so a
  query has to name `user_id` itself. Two things the conversion turned up: the
  planned `postgres.camel` transform would have silently camel-cased the keys
  _inside_ `generation_metadata`, and a row naming itself as its own
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

**Up next**

- The `project-standard` conformance pass (#187): one-folder-per-component,
  CSS Modules over Tailwind, and the `@/` → `#/` alias rename.
- **#178 — canvas arrangement is not user data.** It still lives in IndexedDB;
  it belongs in Postgres now that there is a database the browser cannot reach.

The app is now six surfaces and nothing else: AI Images, Canvas, Activity, Trash,
Settings, Account — plus the AD assistant panel. If something does not serve
generating and keeping images, it was cut on purpose.
