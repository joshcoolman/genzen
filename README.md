# GenZen

The multi-step prompt work that makes AI images good, packaged as things you
can click. Pick a picture, pick a light, press Go. There is no graph to
assemble.

Fan one prompt across several models and compare what comes back side by side.
Keep the results in a library with groups rather than a folder of downloads.
Take one picture and get sixteen camera angles of the same subject, or relight
it under a named lighting setup. Nothing is a credit or a surprise: tick three
models and a count of two and the panel quotes those six generations at $0.304
before you press.

![The Images route: a group of results, each card labelled with the model that
made it, and the generator panel with three models
ticked](public/screenshots/genzen-images.jpg)

_One prompt, two reference images, three models, six pictures — quoted at
$0.304 before the press. Shots and Lighting sit above the references._

These are estimates rather than invoices — FAL's image queue never returns a
cost, so the figure is computed from a published rate and it is the estimate
that gets recorded. Close enough to plan a session against and to know what an
afternoon cost, not close enough to reconcile a bill to the penny. Every
generation's is kept, and Activity and the account page total them.

![The account Overview: total spend, images and videos, a per-model breakdown,
and a status panel showing auth, Postgres, FAL and Anthropic
connected](public/screenshots/genzen-account.jpg)

_Spend to date, split by model, with a running count of what each one made._

## Who it is for

One person, on their own machine, spending their own money at fal.ai. There is
no signup and no hosted version — you supply a FAL key and generations bill
your account directly. It has real accounts and per-user isolation, but no
orgs, teams or sharing. [`docs/OVERVIEW.md`](docs/OVERVIEW.md) says what it
deliberately is not.

Running it is one FAL key and one command. Postgres, storage and auth come up
as local containers, so there is no cloud account to open and nothing to
provision before the app boots; deploying it to Railway is roughly as short.
Setup is below.

## Where this is going

Shots and Lighting look like two features. They are two instances of one
mechanism: a reasoning model looks at your particular picture and inventories
what is actually in it, then applies craft knowledge — photography, lighting,
composition — bound to the surfaces it found. Pass one grounds, pass two
art-directs; `writeLightingSubject`, then `writeLighting`.

The image models cannot do that half. They render what a prompt asks for, and
have no view on why a corner gives a hard vertical edge where a flat wall gives
a gradient, or that a truck has no cheek. The reasoning model is what turns a
vague intention into the instruction an art director would have given.

The same shape has other slots — lens and depth, composition and blocking,
grade and palette — and none of them are built. The one that matters most is
already half-built inside Shots: sixteen frames of one subject have to agree
with each other, and a set that agrees is the hard part of multi-shot video.
Stills are the cheap rehearsal for it.

That is intent rather than a promise. What is actually queued is on the board.

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

**Focus** — [#562](https://github.com/joshcoolman/genzen/issues/562) has its
surface: `/lab/lighting` turns a reference picture into a lighting setup, tests
it on a face and an object, and hands back the text of the `.md`. Open it, drop
Pinterest references at it, and judge what comes back — the effects that survive
get committed to `src/lib/prompts/lighting/`.
[#502](https://github.com/joshcoolman/genzen/issues/502) is also open and
unrelated: two dead webhook variables still set on the deployed Railway service.

Updated when Focus changes. Everything else is the board at
`localhost:3210/kanban/genzen` — **Now** is queued and small things to clear
first, **Next** is an honest read on what follows, Later and Unsorted are
parking lots. The labels are the ranking; a list here would be a second copy
that drifts, and one did.

**Last shipped**

- 2026-09-02 — Lighting: three more effects, each off the gelled-dark-studio axis. Hard Top, Deep Wells (one overhead source, no gel), Neutral Key, Coloured Rim (white light on the subject, the gel confined to edges) and Soft Front, White Ground (high-key, the ground overexposed to white). 24 candidates on a face and a truck settled the prose; the overhead one draws its own lamp on a hard-surfaced subject no matter how the housekeeping line is phrased, which is written down in the registry (#576)
- 2026-09-02 — Lab: an Editor that cuts clips into one real file. In and out points per clip set from the playhead, reordering, one crossfade, and an Export that encodes server-side with the ffmpeg already in the app and lands an ordinary clip in your library — not a browser wasm build, because #499 put real ffmpeg here the day after the ticket was written (#515)
- 2026-09-02 — Enhance's multi-shot writer takes a duration and an aspect ratio as controls instead of reading them out of your prose, and both come off the video model it writes for — so the script is timed to a length the clip can actually be generated at, and composed for the shape it will be generated in (#522)
- 2026-09-01 — README: the front door leads with what genzen is, who it is for and where it is going, rather than with Docker and Node floors. Cost is stated up front — six generations quoted at $0.304 before the press — and honest about being an estimate. Two screenshots, in `public/screenshots/`, referenced repo-relative and rewritten by the `/readme` route (#570)
- 2026-09-01 — Lab: a Lighting page that writes an effect instead of applying one. A reference photograph in, a lighting setup out under a rule that forbids naming a technique or anything in the picture, then four candidates on two pinned test subjects — a face and an object, because prose that describes a photograph passes on faces and returns colour rectangles on a truck. It generates and stores nothing; capture is the text of the `.md` (#562)
- 2026-09-01 — Lighting: a button beside Shots that relights every staged reference under every effect picked, through every model picked. An effect is a lighting setup — sources, angles, gels — and never a description of a picture, which is what makes it land on a truck as readily as a face. Gels are templated with defaults. Both dialogs now close on the press instead of the run (#563)
