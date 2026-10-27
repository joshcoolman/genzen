Working on genzen locally. The README has the three steps; this is everything
behind them. Deploying is `docs/deploying.md`.

## Setup detail

You need pnpm, **Node 22.13+**, and the Vercel CLI logged in. Postgres and
media storage are the Vercel project's own -- Neon and a private Blob store --
and local dev points at them (#777). Nothing runs on the machine but Next; the
app handles authentication.

The Node floor is not cosmetic: `packageManager` pins pnpm 11, which imports
`node:sqlite` and cannot run on Node 20. Corepack fetches pnpm before anything
reads `engines`, so an older Node fails during `pnpm install` with
`ERR_UNKNOWN_BUILTIN_MODULE: node:sqlite` and no mention of your Node version.

A `FAL_KEY` is optional to start -- the app runs without one, but image and video
generation need it. Supplying one means generations bill your fal.ai account;
nothing is mocked.

```bash
pnpm install
pnpm local:up                  # everything else, then the dev server
```

That is the whole setup -- there is no global service to install and no env
file to copy or edit. **`local:up` stops at the first missing thing, says the
one line that fixes it, or fixes it itself.** In order: the Vercel CLI (the one
thing it cannot install), the login (it opens the browser), the project (it
links or creates one named after the folder), the image store and the database
(it provisions both on the project, about a minute the first time), the session
secret, the migrations, your login, and your FAL and optional Anthropic keys,
which it stores on the project so the deployment and the other Macs get them.
Then it starts the dev server and opens the app. Re-run it any time: it is
idempotent and never resets anything. There is no reset: the database is the
real one.

| Thing      | Where                                                     |
| ---------- | --------------------------------------------------------- |
| App        | http://localhost:3000                                     |
| Sign in as | printed by `local:up`, kept in `.env.local`               |
| Data       | the Vercel project's Neon database and Blob store, shared |

There is no shipped account. On the first run `local:up` asks for an email
and a password, with a generated login as the default so Enter alone works,
creates the user, and prints the login; it lands in `.env.local` as
`LOCAL_DEV_EMAIL` / `LOCAL_DEV_PASSWORD` and is never asked for again. Edit either one and re-run to change
it -- the file is the source of truth and the password is re-synced from it,
which is also the whole password-reset story. Because the database is shared,
that login also works on the deployed URL. `pnpm users` manages other accounts
-- list, add, delete.

FAL is not mocked -- generation calls fal.ai for real and costs real money. The
app boots and everything else works without a key. Generation cost estimates are recorded
in the Activity log.

If a shell-exported `FAL_KEY` shadows the one in `.env.local`, `local:up` warns
about it -- that's the usual reason generation 401s.

## Scripts

| Command                 | Purpose                                                                     |
| ----------------------- | --------------------------------------------------------------------------- |
| `pnpm local:up`         | Pull the project's variables, migrate, make a login, start dev              |
| `pnpm dev`              | Next dev server on :3000                                                    |
| `pnpm build`            | Production build                                                            |
| `pnpm test`             | Vitest                                                                      |
| `pnpm check`            | Prettier + ESLint --fix + color, token and class checks (run before commit) |
| `pnpm check:colors`     | Fail on a raw color outside `tokens.css`                                    |
| `pnpm check:tokens`     | Fail on a `var(--x)` that is declared nowhere                               |
| `pnpm check:classes`    | Fail on a CSS module class that is used but never defined                   |
| `pnpm typecheck`        | `tsc --noEmit` (the build typechecks too)                                   |
| `pnpm db:migrate`       | Apply pending `migrations/*.sql`                                            |
| `pnpm users`            | List/add/delete logins on the project database; `-h` for usage              |
| `pnpm check:claude-md`  | What the pre-commit hook checks (advisory)                                  |
| `pnpm activity:inspect` | Load a pasted Activity URL's stored data and media, no browser needed       |
| `pnpm context:find`     | Find uploads/generations by recency, local date or text                     |
| `pnpm context:inspect`  | Load a generation's stored data and media by URL or id                      |
| `pnpm rive:build`       | Rebuild the News progress animation from `rive/news-progress/`              |

## Stack

| Layer        | Tech                                                  |
| ------------ | ----------------------------------------------------- |
| App          | Next.js App Router (React 19 + Turbopack)             |
| UI           | CSS Modules + Base UI, on the tokens in `src/styles/` |
| Data         | Postgres, queried with SQL via `postgres` (no ORM)    |
| Auth         | scrypt + signed session cookie, own `users` table     |
| Storage      | Vercel Blob, one private store, local and deployed    |
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

**Locally there is nothing to configure.** `pnpm local:up` pulls `.env.local`
from the Vercel project and prompts you for the values that are actually yours:
your FAL key, and your Anthropic key if you want the AI-assisted features. The
app runs without the second.

There is no `.env.example`, on purpose: nothing to copy or fill in.
Every variable the app reads, and where its value comes from, is the
Variables table in [`docs/deploying.md`](../deploying.md).

Provider keys are server-only. Only `NEXT_PUBLIC_*` reaches the browser -- Next
inlines nothing else, and the `VITE_` prefix carries no meaning here (#225).
