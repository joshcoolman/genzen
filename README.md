# GenZen

A personal workspace for working with AI image models.

## Up next

The open issues labelled [`focus`](https://github.com/joshcoolman/genzen/labels/focus),
then [`next`](https://github.com/joshcoolman/genzen/labels/next). The labels are
the ranking; a list here would be a second copy of it that drifts.

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
pnpm local:up                  # asks for your FAL key, sets up everything else
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
can run alongside `~/repos/bootsy`.

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
| `pnpm check`           | Prettier + ESLint --fix + color check (run before commit)                                                                       |
| `pnpm check:colors`    | Fail on a raw color outside `tokens.css`                                                                                        |
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
| Text/vision | Anthropic — assistant, prompt work, and vision        |

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
itself and prompts you for the one value that is actually yours, the FAL key.

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
  in `tokens.css` alone — `pnpm check:colors` enforces it (#229).
- `.server.ts` must never be imported from client code; `.action.ts` is a `'use server'` module meant to be. Lint enforces the split (#241).
- FAL generation status is reconciled via on-demand polling in `src/lib/server/check-pending-generations.action.ts`. Webhooks are optional and gated by env.
- The bucket is private, so there are no public object URLs to persist. Images
  are served by the app at `/img/[id]`, which resolves identity from the cookie
  and filters the row by `user_id`. `src/lib/image-url.ts` is the only place a
  URL is built, and it returns an app path, never a storage key (#226).
- Every generate path reserves its `user_images` row _before_ any fallible work,
  so a click always leaves a card behind — pending, completed, or failed with a
  reason and a Retry.

## Last shipped

2026-08-19

- **Groups look and behave like somewhere you went** — opening one now puts its
  name over the thumbnails as a proper heading, with a round back button beside
  it and the whole heading clickable to leave — a single small toolbar control
  used to be both the name and the way out, and read as neither (#432). The
  toolbar keeps no crumb, so Upload stays leftmost and never shifts between the
  two states; it is also green now, the weight Generate has, since the one
  control that puts things into the page was styled like the least important
  thing on it. And **a group can only be
  trashed from inside it** (#431): the card's trash icon was in the same corner
  an image card's is, in a grid that mixes the two, so the click that bins a
  whole group was available from the view that shows least about what is in it.
  It is a labelled control in the toolbar now, which also leaves a group card
  wearing one overlay icon where an image wears two

- **A Variations run goes straight to the Images panel** — "Load in Images" on
  a run in the lab fills the generator's prompt list with the whole set and puts
  the source image in slot 0; you navigate to Images and press Generate. It
  replaces what is in the panel rather than merging into it, the model selection
  is left alone, and nothing runs or is spent. The seam is one named module,
  `src/lib/panel-handoff.ts` — a single record, read once and cleared on
  arrival, deliberately not a queue and not a subscription. Judging whether the
  prompts are good was all the page could do before; judging the pictures took
  four copies, four pastes and re-attaching the source by hand (#433)

- **Widen a picture without writing the prompt** — a new lab page,
  `/lab/outpaint`: pick an image, pick a target aspect ratio, optionally nudge
  it, and generate. The instruction is `src/lib/prompts/outpaint.md`, so tuning
  it is a text edit — which is most of what the page is for. Models are
  multi-select, because one press has to separate two questions: is the
  instruction any good, and can this model outpaint at all. It asks the model
  plainly and composites nothing; whether that is enough, or whether the source
  has to be drawn onto a canvas at the target shape first, is the open question
  the page exists to settle. It is also the first thing in the lab that spends
  real FAL money, so the estimate sits under Generate and each result card
  carries what the run cost (#430)

- **Pull a still out of a clip** — a new lab page, `/lab/frames`: pick one of
  your clips the way you pick a reference image (a plus button, a picker
  dialog), scrub, press Extract frame, and the frame lands in a grid below at
  the clip's own aspect. The grid grows as you switch clips, and both deletes
  trash rather than destroy. Frames are saved as **uploads**, which is the honest
  classification — the frame was not generated by a model, it was cut out of
  something that was — so it appears in Images immediately and is usable as a
  reference image, which is half the point of pulling one. The capture happens in
  the browser on a canvas: there is no ffmpeg on the server and nothing there can
  decode video, and `toBlob` is only allowed because clips come from our own
  `/img/[id]`. Whether seeking lands on the frame you actually stopped on is
  deliberately unanswered — that is the question the page exists to settle by use
  (#317)

- **FLUX.2 Pro replaces FLUX Kontext Pro, and the estimate learned that editing
  costs more** — BFL's own advice is not to use FLUX.1 Kontext for editing any
  more, and the trade was roughly twice the price for eight reference images
  instead of one. Measuring it produced the more useful finding: **every
  megapixel-billed model costs about twice as much through its image endpoint**,
  because FAL's `processed megapixels` counts the images you send as well as the
  one you get back. So the lineup gained `editPrice`, and both the estimate under
  Generate and the picker's `$` column now switch on whether something is staged
  — the same fact `endpointFor` already used to choose the endpoint. An earlier
  extrapolated price was wrong in both directions; sibling megapixel counts do
  not transfer, only the rate does. Found on the way: Canvas curated
  `flux-kontext-pro` by slug, which would have silently shrunk its picker from
  three models to two with nothing failing (#304)

- **A lab, and three features moved into it** — Enhance, Describe and Variations
  were all good ideas, all unfinished, and none of them improvable where they
  lived: each was a button opening a dialog that closed, and a dialog holds
  "type, get one result, close" and nothing more. `/lab` is a section shaped like
  `/account`, with three pages rather than one surface — they look composable and
  are not, each asking a different question about a different input. Each page
  **names the file that steers it**, keeps the input beside the output, and
  counts characters, which is the comparison the dialogs made impossible: an
  eight-word prompt through Enhance comes back at 649. Describe's `anchor` mode
  is reachable for the first time — the dialog hard-coded the other one.
  `/images` is left as though none of it was ever there, down to a localStorage
  map that would have read empty forever while looking live (#424)
