# GenZen

A personal workspace for working with AI image models.

## Run it locally

You need Docker, pnpm, and **Node 22.13+**. No cloud account is required
anywhere — Postgres, auth and storage all run as local containers.

The Node floor is not cosmetic: `packageManager` pins pnpm 11, which imports
`node:sqlite` and cannot run on Node 20. Corepack fetches pnpm before anything
reads `engines`, so an older Node fails during `pnpm install` with
`ERR_UNKNOWN_BUILTIN_MODULE: node:sqlite` and no mention of your Node version.

A `FAL_KEY` is optional to start — the app runs without one and only image
generation fails. Supplying one means generations bill your fal.ai account;
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
which is also the whole password-reset story. `pnpm users` manages accounts on a
deployed instance — list, add, delete — and takes `--local` to work on the
docker stack instead.

FAL is not mocked — generation calls fal.ai for real and costs real money. The
app boots and everything else works without a key. Every generation's cost lands
in the Activity log.

Ports: MinIO is on 9010/9011 rather than its default 9000/9001, so this stack
can run alongside another local one holding MinIO's defaults.

If a shell-exported `FAL_KEY` shadows the one in `.env.local`, `local:up` warns
about it — that's the usual reason generation 401s.

## Scripts

| Command                | Purpose                                                                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm local:up`        | Start the local stack, write `.env.local`                                                                                       |
| `pnpm local:down`      | Stop it (data kept)                                                                                                             |
| `pnpm local:reset`     | Stop it and delete the volumes                                                                                                  |
| `pnpm dev`             | Next dev server on :3000                                                                                                        |
| `pnpm build`           | Production build                                                                                                                |
| `pnpm test`            | Vitest                                                                                                                          |
| `pnpm check`           | Prettier + ESLint --fix + color and token checks (run before commit)                                                            |
| `pnpm check:colors`    | Fail on a raw color outside `tokens.css`                                                                                        |
| `pnpm check:tokens`    | Fail on a `var(--x)` that is declared nowhere                                                                                   |
| `pnpm typecheck`       | `tsc --noEmit` (the build typechecks too)                                                                                       |
| `pnpm db:migrate`      | Apply pending `migrations/*.sql`                                                                                                |
| `pnpm users`           | List/add/delete logins; `-h` for usage, `--local` for docker. Reaching a _deployed_ database needs an authenticated Railway CLI |
| `pnpm check:claude-md` | What the pre-commit hook checks (advisory)                                                                                      |

## Stack

| Layer       | Tech                                                  |
| ----------- | ----------------------------------------------------- |
| App         | Next.js App Router (React 19 + Turbopack)             |
| UI          | CSS Modules + Base UI, on the tokens in `src/styles/` |
| Data        | Postgres, queried with SQL via `postgres` (no ORM)    |
| Auth        | scrypt + signed session cookie, own `users` table     |
| Storage     | S3 — MinIO locally, a Railway bucket in production    |
| Images      | FAL                                                   |
| Text/vision | Anthropic — prompt work, and vision                   |

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

`.env.example` is the reference for deploying, split into Required (a Postgres
URL, a session secret, FAL, an S3 bucket) and Optional (Anthropic).
[`docs/deploying.md`](docs/deploying.md) covers the rest: what a
deployment needs, the two non-default settings, and how the first user is made.

The `R2_*` names are historical and are staying that way (#242). The storage
layer is plain S3 pointing wherever `R2_ENDPOINT` says — MinIO locally, a
Railway bucket in production, Cloudflare R2 nowhere. **The bucket must be
private** (#226); the app serves images itself. `R2_ACCOUNT_ID` derives
Cloudflare's endpoint and is unused.

Provider keys are server-only. Only `NEXT_PUBLIC_*` reaches the browser — Next
inlines nothing else, and the `VITE_` prefix carries no meaning here (#225).

## Conventions / gotchas

- Route protection is deny-by-default in `proxy.ts` — a new public path must be listed in its `PUBLIC_PATHS`.
- No Tailwind and no CSS framework. `src/styles/tokens.css` is the token layer,
  `src/styles/base.css` the reset; everything else is a `.module.css` beside its
  component. `src/styles.css` imports those two and nothing else. Colors live
  in `tokens.css` alone — `pnpm check:colors` enforces it (#229), and
  `pnpm check:tokens` fails on a `var(--x)` declared nowhere (#407). The second
  matters because an undeclared property does not error, it is dropped, so it
  breaks silently.
- `.server.ts` must never be imported from client code; `.action.ts` is a `'use server'` module meant to be. Lint enforces the split (#241).
- FAL generation status is reconciled via on-demand polling in
  `src/lib/server/check-pending-generations.action.ts`. **There are no webhooks** —
  the route, the flag and the env vars went in #362, and polling is the only path
  by which a result reaches the app.
- The bucket is private, so there are no public object URLs to persist. Images
  are served by the app at `/img/[id]`, which resolves identity from the cookie
  and filters the row by `user_id`. `src/lib/image-url.ts` is the only place a
  URL is built, and it returns an app path, never a storage key (#226).
- Every generate path reserves its `user_images` row _before_ any fallible work,
  so a click always leaves a card behind — pending, completed, or failed with a
  reason and a Retry.

## Status

**Last shipped**

- 2026-08-29 — `H` in the image viewer hides the picture you are looking at and moves on, the way Delete already trashes it and moves on. Delete destroys, H clears away — the card's own pairing, at the surface where the judging happens. Both are buttons on the picture as well as keys, so the destructive verb is not the only visible one (#545, first half)
- 2026-08-29 — The hidden bar reports what is hidden where you are standing, not everywhere. It counted the whole library while the wall showed one group, and `Show` acted on that list — so pressing it inside a group unhid the library. The rule that settles it: the bar says what would come back if you pressed Show. A group card now says ", 3 hidden" beside its count, so hiding inside a group is not invisible from outside it (#546)
- 2026-08-29 — Hide works on Video the way it does on Images: a corner icon on the clip card that hides in one click and becomes Trash under Cmd, Hide and Focus in the selection drawer, and a bar above the wall listing what is held. The mechanism moved to `src/features/visibility/` on the two-consumer rule; the write never filtered on `source`, so this was a surface job (#537)
- 2026-08-29 — Images in a group can be arranged by hand: drag a card and it stays where you put it. `group_position` is nulls-last, so a new image lands at the end with nothing written on any insert path, and `By date | Manual` is non-destructive in both directions — switching away keeps the arrangement (#505)
- 2026-08-29 — Drag a thumbnail onto a group card to file it there. Drag a card that is part of a selection and the whole selection comes; drag an unselected one and it moves alone. The picker dialog stays, for a group scrolled out of view (#438)
- 2026-08-29 — The clip card is built to be scanned: the prompt reserves its three lines and the facts sit on the card's bottom edge, so every card in a row reads its numbers off one line. Continue is a circle and an arrow, the tick and the `...` are one size, and in select mode the whole picture selects — which stops playback, so picking and watching are never the same screen (#536)

**Up next**

**Asset management**, taken as one arc rather than four separate passes — the
library has grown past the point where generating is the hard part, and these
interlock:

1. [#545](https://github.com/joshcoolman/genzen/issues/545) — the half that is
   left: a viewer over the hidden set, for the second pass. #546 settled what
   it opens over — what is hidden where you are standing, the same set the bar
   counts. What is undecided is where the way in lives, the tray being a row of
   single-verb thumbnails today.
2. [#543](https://github.com/joshcoolman/genzen/issues/543) +
   [#544](https://github.com/joshcoolman/genzen/issues/544) — locking and
   labels, designed together. Build them apart and you get two marking systems
   on one card whose corners are already spoken for; deciding once whether
   "locked" is a reserved label is cheap now and a migration later.
   [#513](https://github.com/joshcoolman/genzen/issues/513) is annotation, which
   is the same instinct — read it before designing labels.

Everything else: the open issues labelled
[`focus`](https://github.com/joshcoolman/genzen/labels/focus), then
[`next`](https://github.com/joshcoolman/genzen/labels/next). The labels are the
ranking; a full list here would be a second copy of it that drifts.
