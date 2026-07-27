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

**Last shipped** (2026-07-26)

- **Generations no longer hang on pending (#174, partial).** FAL settled them
  fine; the UI never heard. Realtime delivers nothing — `user_images` is in no
  publication, and the browser client lost its Supabase session with #171 — so
  the 5s poll now drives the refetch in AI Images, generation results, and
  Activity. The five dead channels are still in place.
- **The app runs on Next (#175).** TanStack Start, Router, Vite and Nitro are
  gone — 15 file routes became `app/` route folders, 20 `createServerFn`
  definitions became server actions, and the FAL webhook became a route handler.
- **Auth is the cookie session (#171, absorbed into the port).** `proxy.ts` is
  deny-by-default: every path is private unless listed. `resolveAuth()` reads
  identity from the cookie, which retired `jose`, the remote-JWKS verification,
  and all 232 `accessToken` references that used to ride in request bodies.
- **`useAuth()` returns a non-nullable user.** The layout resolves it server-side
  and hands it down, so the loading/redirect dance every page opened with is gone
  — as is `onAuthStateChange` and the localStorage session.
- **Plain Postgres, scrypt auth, and a one-command local stack** landed for #168
  — `migrations/0001_init.sql`, `pnpm auth:create-user`, and a `local:up` that
  brings up both databases.
- **45 migrations collapsed into one baseline**, generated from the live database
  and verified structurally against it.

**Up next**

- **#173 — browser data access, and it is now load-bearing.** ~55 `.from()` calls
  still run through the anon browser client against `auth.uid()` RLS, which no
  longer resolves. A clean browser sees an empty gallery; a stale localStorage
  session from before #171 is the only reason it looks like it works. Biggest
  offenders: `useTrash.ts` (15), `use-images.ts` (14), `canvas/lib/persistence.ts` (7).
- **Signing in gives you an empty library today.** Login verifies against the new
  `users` table, whose ids are freshly generated, while `user_images.user_id`
  still holds Supabase auth uuids. Provision the local user with the matching
  uuid, or move the data, before expecting to see anything.
- **#174 — remove the 5 dead realtime channels.** Best done per-file alongside
  #173, since both land in the same hooks. Then **#176 — delete Supabase**.
- Then the `project-standard` conformance pass: one-folder-per-component and
  CSS Modules over Tailwind.

The app is now six surfaces and nothing else: AI Images, Canvas, Activity, Trash,
Settings, Account — plus the AD assistant panel. If something does not serve
generating and keeping images, it was cut on purpose.
