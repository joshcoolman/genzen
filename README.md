# GenZen

A personal workspace for working with AI image models. Fan one prompt across
several models and compare side by side, run non-destructive edit and variation
flows, and arrange results on an infinite canvas.

This is a tool I built for myself and use. It is public because there's no reason
for it not to be — not because it's a product. There's no signup, no billing, no
support, no roadmap. MIT licensed; fork it and make it yours.

**Up next** — the ordered detail is in [Status](#status) at the bottom.

1. **#209** — the data model conformance pass. Four facts, four mutabilities,
   currently collapsed into one JSONB bag and a boolean.
2. **#189** — the canvas half of the route split, now unblocked.
3. **#213** — the ephemeral search overlay. The payoff #209 is for.

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
generates and provisions a login, and prompts for the FAL key. Re-run it any
time: it is idempotent, it keeps your key, and it never resets a database you
have been working in. `pnpm local:reset` is the deliberate way to start over.

| Thing         | Where                                               |
| ------------- | --------------------------------------------------- |
| App           | http://localhost:3000                               |
| Sign in as    | printed by `local:up`, kept in `.env.local`         |
| MinIO console | http://localhost:9011 (`genzenlocal`/`genzenlocal`) |
| Postgres      | `postgres://genzen:genzen@localhost:5434/genzen`    |

There is no shipped account. `local:up` generates a password on first run,
creates the user, and prints the login; it lands in `.env.local` as
`LOCAL_DEV_EMAIL` / `LOCAL_DEV_PASSWORD`. Edit either one and re-run to change
it — the file is the source of truth and the password is re-synced from it,
which is also the whole password-reset story. `pnpm auth:create-user` is the
path for an additional or non-local account.

FAL is not mocked — generation calls fal.ai for real and costs real money. The
app boots and everything else works without a key. Every generation's cost lands
in the Activity log.

Ports: MinIO is on 9010/9011 rather than its default 9000/9001, so this stack
can run alongside `~/repos/bootsy`.

If a shell-exported `FAL_KEY` shadows the one in `.env.local`, `local:up` warns
about it — that's the usual reason generation 401s.

## Scripts

| Command                 | Purpose                                     |
| ----------------------- | ------------------------------------------- |
| `pnpm local:up`         | Start the local stack, write `.env.local`   |
| `pnpm local:down`       | Stop it (data kept)                         |
| `pnpm local:reset`      | Stop it and delete the volumes              |
| `pnpm dev`              | Next dev server on :3000                    |
| `pnpm build`            | Production build                            |
| `pnpm test`             | Vitest                                      |
| `pnpm check`            | Prettier + ESLint --fix (run before commit) |
| `pnpm typecheck`        | `tsc --noEmit` (the build typechecks too)   |
| `pnpm db:migrate`       | Apply pending `migrations/*.sql`            |
| `pnpm auth:create-user` | Create a user, or reset one's password      |
| `pnpm check:claude-md`  | What the pre-commit hook checks (advisory)  |

## Stack

| Layer       | Tech                                                       |
| ----------- | ---------------------------------------------------------- |
| App         | Next.js App Router (React 19 + Turbopack)                  |
| UI          | CSS Modules + Base UI, on the tokens in `src/styles/`      |
| Data        | Postgres, queried with SQL via `postgres` (no ORM)         |
| Auth        | scrypt + signed session cookie, own `users` table          |
| Storage     | S3 — MinIO locally, Cloudflare R2 in prod                  |
| Images      | FAL                                                        |
| Text/vision | Anthropic (assistant, prompt work), Google Gemini (vision) |

## Repo map

| Path                     | What's there                                                                              |
| ------------------------ | ----------------------------------------------------------------------------------------- |
| `src/features/<name>/`   | Domain modules. **Each has its own `CLAUDE.md` — read it before editing the feature.**    |
| `src/lib/server/`        | Server-only helpers (files use `.server.ts` suffix).                                      |
| `src/components/`        | Primitives, one folder each, imported from the root barrel `#/components`.                |
| `app/api/`               | Route handlers (e.g. `app/api/fal-webhook/route.ts`).                                     |
| `migrations/`            | Numbered SQL migrations, applied by `pnpm db:migrate`.                                    |
| `CLAUDE.md`              | Feature catalog + service / convention notes.                                             |
| `docs/SPEC.md`           | What the app does and the rules that must hold.                                           |
| `docs/OVERVIEW.md`       | What genzen is, and what it deliberately is not.                                          |
| `docs/CODE-STANDARDS.md` | genzen's deltas from [project-standard](https://github.com/joshcoolman/project-standard). |

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
- No Tailwind and no CSS framework. `src/styles/tokens.css` is the token layer,
  `src/styles/base.css` the reset; everything else is a `.module.css` beside its
  component. `src/styles.css` only imports those two.
- Server-only code uses the `.server.ts` suffix; do not import it from client code.
- FAL generation status is reconciled via on-demand polling in `src/lib/server/check-pending-generations.server.ts`. Webhooks are optional and gated by env.
- S3 public URLs do not expire — safe to persist in DB rows.
- Every generate path reserves its `user_images` row _before_ any fallible work,
  so a click always leaves a card behind — pending, completed, or failed with a
  reason and a Retry.

## Status

Orientation lives here and in open issues — there is no continuation or plan file.
Conventions follow [project-standard](https://github.com/joshcoolman/project-standard).
GenZen is public-and-messy on purpose: the exploration home where ideas are tried
in the open, on a clean substrate; bootsy consolidates what proves out (#222).

**Last shipped** (2026-07-29)

- **A canvas is a container, not a view (#212).** Membership as rows in `canvas_images`; arrangement left IndexedDB, and trashing no longer evicts from a canvas.
- **Origin is a column, and Images is scoped by it (#207).** `upload | images | canvas`, `not null` with no default, so an unmarked generation source cannot compile.
- **The insert-path inventory is written (#211).** `docs/reference/insert-paths.md` — exactly two insert statements in the app. Filed #215 out of it.
- **Two data losses closed (#210).** The typed prompt survives enhancement, and a pasted source carries a sha256 instead of a boolean.
- **Images has the route shape (#189, half).** Server read, `view.tsx` + `use-view.ts`, six component folders came home. Canvas is the other half.
- **The `/edit` route is gone, replaced by a highlight (#205).** A highlighted image is the next prompt's primary reference; 2,158 lines of route out.

**Up next** — the finish state agreed in **#222**: a short close-out list, then one
live exploration. **#189** first — the canvas half of the route split, which closes
epic **#209**. Then the close-out list, small items in any order:

- **#214** — Retry drops the focus image: replay the whole request, not the prompt.
- **#215** — three upload implementations, one thumbnail. Canvas paste/drop skips `createThumbnail`.
- **#219** — `user_id` scoping: add the lint/ast-grep mechanism, close. Skip the RLS debate.
- **#216** — ship the passive "on canvas" marker only; the confirm-dialog half stays deferred.
- **#188** — rewrite `docs/reference/architecture.md`.
- **#194** — canvas Undo does not restore. After #189; refresh its stale pre-#212 body first.

**#213** is the live exploration the close-out clears room for — the ephemeral
search overlay, the payoff of #209's data work. A grouping spike (loose, ephemeral,
focus-not-taxonomy — explicitly not #204's grouping) is the exploration after; it
gets filed when #213 makes room. Agent-facing designs (provenance graph, MCP
learnings) are parked as prose in `docs/reference/agent-substrate.md`.
- **#200** — hybrid Vercel/Railway topology exploration.

The app is four surfaces and nothing else: Images, Canvas, Activity, Trash — plus
Account. No assistant, no image grouping (canvas's spatial groups are a different
thing and are alive), no separate edit page. If something does not serve
generating and keeping images, it was cut on purpose.
