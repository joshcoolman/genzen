# GenZen

A personal workspace for making, comparing, and organizing AI images and video.
Work from prompts and reference images, try several models at once, and keep the
results together with the context that made them.

The working principle is immediate feedback: capture the idea, show the work in
progress, and let the next idea follow. Image submissions show pending thumbnails
before planning or rendering finishes, so you can keep prompting while earlier
batches run in the background.

![Images with grouped results, model labels, reference images, and a multi-model
generator](public/screenshots/genzen-images.jpg)

## Images: explore several directions at once

Send one or several prompts to multiple models, choose how many results you want
from each, and compare the outputs side by side. Attach uploaded or generated
images as references, with their order visible in the composer. The panel shows
the output count and estimated cost before you generate.

Images is also the working library. Generate inside a group and the results land
there; generate at the top level and they stay there. Hide the takes you do not
want to look at, restore hidden images when needed, and use Trash for removal.
Open an image at a larger size to judge it, inspect its details, or load its
prompt and references back into the composer for another pass.

## Storyboards: full-size shots from one idea

Type `/storyboard` directly in the image prompt field, followed by a scene idea.
Attach references for the subject, setting, or look you want to carry through.
For example:

```text
/storyboard Six shots of this vehicle driving through an empty downtown.
Start wide, move closer, and finish beside a deserted fountain.
```

A shared plan establishes continuity and assigns each shot its own composition.
Every shot is generated as a separate full-size image using the original
references. The default is six 16:9 shots; request two through nine in the brief
or with `--shots N`.

The output count includes shots, models, and variants. After any batch
confirmation, every shot gets its own numbered pending thumbnail immediately,
and the composer remains available for more work. Results stay in the current
group or at the top level.

If you later want a single sheet, select the images and use **Reference sheet**
to assemble a downloadable composite.

## Develop a picture further

**Shots** explores camera angles around a subject. **Lighting** applies named
lighting setups to the reference images. Both use a reasoning model to inspect
the actual subject and turn the chosen direction into rendering instructions.
**Outpaint** reframes a finished image into other aspect ratios.

These tools create new images, keeping the source available for another attempt.
Download individual results, a group, or a selection as a ZIP.

## Video: direct the motion and review the result

Generate a clip from a prompt, add a first or last frame, or supply reference
images where the chosen model supports them. Image roles are explicit, and model
compatibility, duration, shape, and resolution guide the available choices.
Several prompts can produce several clips in one submission. Seedance 2.5 is
available alongside Kling, MiniMax, LTX, and Flux, with reference images or
first/last frames, native audio, and clips up to 30 seconds. For models that
support sound, **Generate audio** lets you choose audio or silent output.

Click a video thumbnail to open a large player with the complete frame, playback
controls, and fullscreen support. First and last frame previews help you scan
clips in the library. **Continue** takes a clip's ending as the starting image
for the next generation and brings its prompt forward for editing.

Organize clips in video groups, hide takes while comparing results, and use
Trash for removal. Generating inside a video group keeps the new clips there.

## Director: build a sequence over time

A session is a name and a run of clips. Pick clips you already have, drag them
into order, and watch them back to back — the question the whole page is for is
whether the order cuts together and whether the next clip follows.

**Add gen** makes the next clip from inside the run: the last clip's final frame
in the first slot, a prompt, a duration, one button. The pencil on a tile names
a clip, or re-rolls it in place — a clip in the middle is pinned at both ends,
so the joins either side survive. Clips are ordinary library rows, so they are
on the Video wall, in Activity, and trashed from there like anything else.

## Keep the context and the cost

**Activity** records generation prompts, references, model settings, timing,
estimated cost, and failures. Storyboard runs retain the shared plan and each
shot's rendering request. For images, **Load** restores an editable starting
point, while **Retry** replays a failed request's saved inputs and settings.

**Account** summarizes recorded spend and output counts by model, alongside
connection status, appearance settings, and keyboard shortcuts. Costs are
estimates, not invoices: provider billing can differ, and AI planning can add
usage beyond the image estimate shown in the composer.

![Account overview with estimated spend, output counts, model breakdowns, and
connection status](public/screenshots/genzen-account.jpg)

## Lab

Lab is where ideas, model capabilities, and workflows are being worked out and
experimented with. Its tools can change as we learn what is useful; the main
workspaces are where established workflows live.

## Who it is for

GenZen is a personal creative workspace, with real accounts and per-user
isolation but no public signup, teams, or sharing. Run it locally or deploy your
own instance; generations bill the provider accounts whose keys you configure.

Postgres and media storage run locally with Docker. FAL provides image and video
generation, and Anthropic provides the reasoning and vision used by AI-assisted
workflows such as storyboards. The app can start without provider keys; the
features that call those providers need their keys configured.

## Run it locally

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
- Image batches create optimistic cards before preparation starts, then reconcile
  them with saved generation rows. Preparation and submission failures remain
  visible instead of silently dropping the request.

## Status

**Focus** — nothing in flight, and Focus is empty: promote from Now. The
storyboard is shipped end to end and the day's review is merged (#703).

**Respelling works** — confirmed 2026-09-18, `day-KART` said correctly on a row
that had been getting Descartes wrong. The spelling is the instruction and plain
letters are enough, so nothing cleverer is needed.

One question is still open, and generating answers it, not reading. **Does the
voice hold between sections?** Generate two _adjacent_ rows and listen to the
join; that also says whether the no-music rule is holding. Seedance is on the
board for exactly this — it takes a seed where Kling takes none, and its
`audio_urls` (reference audio, unused because genzen has no audio asset) is the
real answer if drift turns out to be what ruins the film.

Known and worked around: Kling refuses a line naming a trademarked work, which
is what the editable line on each row is for. **#705 is the one with a deadline
attached** — the deployed database still holds the old Director's rows.

Recent highlights:

- A storyboard row generates its own section, on Kling O3 Pro or Seedance 2.5:
  the approved opening frame is the clip's first frame where the model pins one,
  the sheets ride along, and takes add rather than replace. No music by
  instruction; atmospherics only (#697, #702).
- A scene's spoken line can be respelled for pronunciation or reworded by hand,
  beside the script rather than over it -- which is also how a line refused for
  naming a trademarked work gets made (#700).
- A Storyboard tab on a Director session: one row per numbered script line,
  each drawn as the frame it opens on and the frame it ends on, from the
  sheets. No video — a few dollars against $38 for one video pass (#695).
- A Director session is a container for more than the run: Characters and
  Locations tabs holding reference sheets extracted from its own clips, and a
  Script tab holding the dialogue with each clip's duration. Drawn as Images
  cards, isolated from Images the way the clips are from Video (#690).
- Director chat answers are written as speech first, in the character's
  voice, then cut into five-second bursts word for word (#683). The audience
  is fifteen to adult whoever answers (#682).
- Director is isolated from Video: a clip born in a session is stamped at
  birth, shown only there, and trashed when it leaves the run, is re-rolled,
  or the session is deleted. Add clips is gone (#679, backfill in 0021).
- Chat questions queue and the box never locks; an answer landing mid-answer
  is the next clip, not a jump (#678).
- Chat anchors -- character once per session, scene once per answer -- are
  prepended in code, and a chat's Script is its questions and answers (#677).
- Chat bursts play in order as they land, once, with a Loop toggle; Sonnet 5
  writes the answer (#675, #676).

The work board is at `localhost:3210/kanban/genzen`. Issues and their labels hold
what is in progress and what comes next; this README describes what is available.
