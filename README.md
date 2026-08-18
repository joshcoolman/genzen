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
| `app/api/`             | Route handlers (e.g. `app/api/fal-webhook/route.ts`).                                     |
| `migrations/`          | Numbered SQL migrations, applied by `pnpm db:migrate`.                                    |
| `docs/SPEC.md`         | What the app does and the rules that must hold.                                           |
| `docs/OVERVIEW.md`     | What genzen is, and what it deliberately is not.                                          |
| `docs/DELTAS.md`       | genzen's deltas from [project-standard](https://github.com/joshcoolman/project-standard). |

## Env

**Locally there is nothing to configure.** `pnpm local:up` writes `.env.local`
itself and prompts you for the one value that is actually yours, the FAL key.

`.env.example` is the reference for deploying, split into Required (a Postgres
URL, a session secret, FAL, an S3 bucket) and Optional (Anthropic, FAL
webhooks). [`docs/deploying.md`](docs/deploying.md) covers the rest: what a
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

2026-08-18

- **Activity shows clips, which it never has** — the log filtered
  `source = 'ai_generated'` and clips are `ai_video`, so every clip ever
  generated was absent from the one surface whose job is recording what a
  generation cost. They are the expensive half by a wide margin: $4.50 of $6.04
  here, from a tenth of the runs — and the account overview shipped two days
  earlier counted them, so the same money had two answers on two pages. The
  predicate was one line; carrying `source` to the client, naming a clip from
  `model_label` (the image lineup cannot resolve a video endpoint), teaching the
  model filter that one video model is two or three endpoints, and making four
  render sites video-aware was the rest. The video lineup moved to
  `src/features/video/` on its second consumer, and `MediaBox` is the "a clip
  needs a `<video>`" decision made a component on its third copy. `#t=0.001` is
  what paints a frame — `preload="metadata"` alone paints nothing, which had
  been believed since #384 (#398, Activity half; the rest of that issue is now
  four undecided surfaces)

- **The account overview earns the visit** — two columns: who you are and what you have spent on the left, service status and recent runs on the right. The figures are aggregated in SQL out of `user_images`, which _is_ the generation ledger, and **video is counted** — so this is the first surface anywhere in genzen where video spend is visible, without waiting on #398. It is also the first thing to say how lopsided that is: video is three quarters of the total. Every figure is labelled estimated, because FAL reports no cost on any image result. Two things were quietly broken and are now fixed: the status block reported a red `Error` for a FAL key that worked perfectly (the SDK throws its 404 with an empty message, so nothing matched), and every check now carries the fix rather than a raw error string. Last login needed the one migration on the page (#406, phase 2)
- **Two models recorded no cost, and Nano Banana was priced at half** — `compute seconds` was the one FAL billing unit nothing handled, so FLUX.2 Flash and Grok wrote no cost at all; it is now priced at completion from the result's measured inference time, and deliberately not rounded to a whole cent, since a run of that model is worth $0.0004. Nano Banana 2 read $0.04 in the picker against FAL's $0.08 — the row estimate had it right, so the two halves of the app disagreed on a daily driver. Grok is the one price that still does not reconcile and says so in the lineup (#400, and #400 stays open for the usage-API work)
- **Account is a settings area, and the app is themeable** — a rail down the left of /account holds Overview, Style and Shortcuts; `/shortcuts` moved under it and left the app's own nav. Style is six colors, and the other four palette tokens are derived from them: one `<style>` block in the authenticated layout restyles every route, server-rendered so there is no flash. **No component's styling was touched** — that was the point, and the proof that #229's palette work holds. It derives in HSL with no color library, because `tokens.css` claims one notation for every value; and it emits nothing at all without a saved row, so the defaults and the stylesheet cannot drift apart. Found on the way: `overflow-x: hidden` on the app shell had been silently disabling `position: sticky` app-wide, since nothing was sticky until this rail (#406, phases 1 and 3)
- **Thumbnail zoom, from the keyboard or the toolbar** — ⌘⌃+ / ⌘⌃- steps the /images grid through four stops (50, 60, 75, 100), ⌘⌃0 back to 100%, and a magnifier in the toolbar opens the same stops on hover. It is `zoom` on the grid element, so cards and captions scale together and nothing re-wraps — only how many fit a row. The stops are measured rather than chosen: the grid is `auto-fill` over a 200px minimum, so only a step crossing a column-count threshold reads as a change, and an even 10% left three consecutive stops on four columns. Not #284's size switcher returning — one multiplier, no named sizes, identical card at every size. The toolbar picked up a pass on the way: lit toggles are a raised surface rather than an accent tint, sort and zoom are outlined since they never light up, and every overlay icon button is now the circle the select tick already was (#403)
- **Explore steps on the mouse wheel** — wheel anywhere over the overlay moves one image, mouse and trackpad both, with a rate cap so an inertia tail cannot fly through the set. The handler was the small part: paging blanked the frame on every step, resetting `loaded` and showing a pulsing placeholder even when the next image was already cached. It now holds the outgoing image until the incoming one decodes, so stepping is instant rather than a strobe (#393)
