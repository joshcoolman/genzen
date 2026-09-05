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

**Focus** — [#597](https://github.com/joshcoolman/genzen/issues/597): saved exports within Director sessions, part of [#594](https://github.com/joshcoolman/genzen/issues/594).
Director lives at `/director`, with named sessions, durable clips and pending
requests, and explicit import of the browser-local Lab cut. The existing
continuation, latest-section Redo, silent playback and selective MP4 download
remain. Its media is separate from Video, Images, Activity and shared Trash.

Updated when Focus changes. Everything else is the board at
`localhost:3210/kanban/genzen` — **Now** is queued and small things to clear
first, **Next** is an honest read on what follows, Later and Unsorted are
parking lots. The labels are the ranking; a list here would be a second copy
that drifts, and one did.

**Last shipped**

- 2026-09-04 — Select mode's verbs take over the generator column on a wide screen. A bar fixed to the bottom of the viewport is easy to miss unless you already know it is there — it sits in peripheral vision while you are looking at the grid, which is the one place you are not looking; the column is where the page's controls already are. Grey filled rows, two groups either side of a rule (what the selection becomes, then what you take away from it), and a click on the empty column deselects. Images and Video each list their verbs once and hand them to whichever container the width chooses, the column above 60rem and the same bottom drawer below it. Trash keeps the drawer: it has no column to take over. **Focus is gone** — it showed only the selection and hid the rest, and its verb was its only way in, so what is left of it is #590 (#587)

- 2026-09-03 — `Describe` in an image card's `...` menu writes a prompt for that picture onto its own row. `reconstruct`, not `anchor`: the stored string is meant to be run, so once it lands the caption is a prompt and Cmd-clicking it loads a fresh take on the same subject into the panel — the fastest route to "another one like this", and a different result from staging the upload as a reference, which pins the output to the original. Almost nothing was needed: `updateImageDescription` had sat in `images.action.ts` with no callers, and `captionImage` already downloaded the bytes. Uploads only, since a generation's caption is already its own prompt (#586)

- 2026-09-03 — Prompts are no longer cut to 1000 characters when saved. `description` had carried that check since `0001_init.sql` and the completion path wrote around it at 997 plus an ellipsis; a Shots prompt ending mid-word in the new viewer panel is what exposed it. Nothing was lost — the full string was in `generation_metadata`, and `0014` restored 140 of 140 rows — but the card's caption feeds the generator, so a cut prompt could be resubmitted and made permanent. The card and the panel now read the metadata first (#582)
- 2026-09-03 — The images viewer has a prompt column you can switch off. `P` toggles it and the answer is remembered, on by default: judging a set means reading the text that made each take, and the alternative was closing the viewer to read the card's clamped three lines. Width is `clamp(18rem, 25%, 34rem)` rather than a bare quarter. Explore's three-column overlay is still not shared — what makes this right where that was wrong is that it is opt-out (#580)
- 2026-09-02 — Lab: a People page. Press Generate Person, look, press again: Claude invents someone unlike everyone already on the board — because ten independent presses of one prompt return the same man ten times, which 60 images settled — and submits them as ordinary generations, so a face is in Images, Activity and Trash like any other picture. Three models survived a nine-model sweep; Z-Image Turbo drafts at half a cent. `+` on a face gets another from its bucket (#578)
- 2026-09-02 — Lighting: three more effects, each off the gelled-dark-studio axis. Hard Top, Deep Wells (one overhead source, no gel), Neutral Key, Coloured Rim (white light on the subject, the gel confined to edges) and Soft Front, White Ground (high-key, the ground overexposed to white). 24 candidates on a face and a truck settled the prose; the overhead one draws its own lamp on a hard-surfaced subject no matter how the housekeeping line is phrased, which is written down in the registry (#576)
