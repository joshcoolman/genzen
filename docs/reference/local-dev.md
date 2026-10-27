Working on genzen locally. The README has the three steps; this is everything
behind them. Deploying is `docs/deploying.md`.

## Setup detail

You need Docker, pnpm, and **Node 22.13+**. Postgres and media storage run
in local containers; the app handles authentication.

The Node floor is not cosmetic: `packageManager` pins pnpm 11, which imports
`node:sqlite` and cannot run on Node 20. Corepack fetches pnpm before anything
reads `engines`, so an older Node fails during `pnpm install` with
`ERR_UNKNOWN_BUILTIN_MODULE: node:sqlite` and no mention of your Node version.

A `FAL_KEY` is optional to start — the app runs without one, but image and video
generation need it. Supplying one means generations bill your fal.ai account;
nothing is mocked.

```bash
pnpm install
pnpm local:up                  # asks for your API keys, sets up everything else
pnpm dev                       # http://localhost:3000
```

That is the whole setup — there is no global CLI to install and no env file to
copy or edit. `local:up`
starts Postgres and MinIO (S3-compatible storage) from `docker-compose.yml`,
writes `.env.local` for you, applies any migrations the database has not seen,
generates and provisions a login, and prompts for your FAL and optional
Anthropic keys. Re-run it any time: it is idempotent, it keeps your key, and it never resets a database you
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
which is also the whole password-reset story. `pnpm users` manages accounts on a
deployed instance — list, add, delete — and takes `--local` to work on the
docker stack instead.

FAL is not mocked — generation calls fal.ai for real and costs real money. The
app boots and everything else works without a key. Generation cost estimates are recorded
in the Activity log.

Ports: MinIO is on 9010/9011 rather than its default 9000/9001, so this stack
can run alongside another local one holding MinIO's defaults.

If a shell-exported `FAL_KEY` shadows the one in `.env.local`, `local:up` warns
about it — that's the usual reason generation 401s.

## Scripts

| Command                 | Purpose                                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm local:up`         | Start the local stack, write `.env.local`                                                                                       |
| `pnpm local:down`       | Stop it (data kept)                                                                                                             |
| `pnpm local:reset`      | Stop it and delete the volumes                                                                                                  |
| `pnpm dev`              | Next dev server on :3000                                                                                                        |
| `pnpm build`            | Production build                                                                                                                |
| `pnpm test`             | Vitest                                                                                                                          |
| `pnpm check`            | Prettier + ESLint --fix + color, token and class checks (run before commit)                                                     |
| `pnpm check:colors`     | Fail on a raw color outside `tokens.css`                                                                                        |
| `pnpm check:tokens`     | Fail on a `var(--x)` that is declared nowhere                                                                                   |
| `pnpm check:classes`    | Fail on a CSS module class that is used but never defined                                                                       |
| `pnpm typecheck`        | `tsc --noEmit` (the build typechecks too)                                                                                       |
| `pnpm db:migrate`       | Apply pending `migrations/*.sql`                                                                                                |
| `pnpm users`            | List/add/delete logins; `-h` for usage, `--local` for docker. Reaching a _deployed_ database needs an authenticated Railway CLI |
| `pnpm check:claude-md`  | What the pre-commit hook checks (advisory)                                                                                      |
| `pnpm activity:inspect` | Load a pasted Activity URL's stored data and media, no browser needed                                                           |
| `pnpm context:find`     | Find uploads/generations by recency, local date or text                                                                         |
| `pnpm context:inspect`  | Load a generation's stored data and media by URL or id                                                                          |
| `pnpm rive:build`       | Rebuild the News progress animation from `rive/news-progress/`                                                                  |

## Stack

| Layer        | Tech                                                  |
| ------------ | ----------------------------------------------------- |
| App          | Next.js App Router (React 19 + Turbopack)             |
| UI           | CSS Modules + Base UI, on the tokens in `src/styles/` |
| Data         | Postgres, queried with SQL via `postgres` (no ORM)    |
| Auth         | scrypt + signed session cookie, own `users` table     |
| Storage      | S3 — MinIO locally, a Railway bucket in production    |
| Images/video | FAL                                                   |
| Text/vision  | Anthropic — prompt work, and vision                   |

## Repo map

Checked by `src/lib/repo-map.test.ts` — a path named here that does not exist
fails the build.

| Path                   | What's there                                                                              |
| ---------------------- | ----------------------------------------------------------------------------------------- |
| `src/features/<name>/` | Domain modules. **Each has its own `CLAUDE.md` — read it before editing the feature.**    |
| `src/lib/server/`      | `.server.ts` = never client-importable; `.action.ts` = a `'use server'` module.           |
| `src/components/`      | Primitives, one folder each, imported from the root barrel `#/components`.                |
| `app/api/`             | Route handlers (`app/api/auth/sign-out/`).                                                |
| `migrations/`          | Numbered SQL migrations, applied by `pnpm db:migrate`.                                    |
| `docs/SPEC.md`         | What the app does and the rules that must hold.                                           |
| `docs/OVERVIEW.md`     | What genzen is, and what it deliberately is not.                                          |
| `docs/DELTAS.md`       | genzen's deltas from [project-standard](https://github.com/joshcoolman/project-standard). |

## Env

**Locally there is nothing to configure.** `pnpm local:up` writes `.env.local`
itself and prompts you for the values that are actually yours: your FAL key,
and your Anthropic key if you want the AI-assisted features. The app runs
without the second.

There is no `.env.example`, on purpose: nothing to copy or fill in.
Every variable the app reads, and what a deployment sets it to, is the
Variables table in [`docs/deploying.md`](../deploying.md), which also covers
the two non-default settings and how the first user is made.

The `R2_*` names are historical and are staying that way (#242). The storage
layer is plain S3 pointing wherever `R2_ENDPOINT` says — MinIO locally, a
Railway bucket in production, Cloudflare R2 nowhere. **The bucket must be
private** (#226); the app serves images itself. `R2_ACCOUNT_ID` derives
Cloudflare's endpoint and is unused.

Provider keys are server-only. Only `NEXT_PUBLIC_*` reaches the browser — Next
inlines nothing else, and the `VITE_` prefix carries no meaning here (#225).
