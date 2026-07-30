# GenZen

A personal workspace for working with AI image models. Fan one prompt across
several models and compare side by side, run non-destructive edit and variation
flows, and arrange results on an infinite canvas.

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

That is the whole setup, and Docker plus pnpm are the only prerequisites --
there is no global CLI to install and no env file to copy or edit. `local:up`
starts Postgres and MinIO (S3-compatible storage) from `docker-compose.yml`,
writes `.env.local` for you, applies any migrations the database has not seen,
provisions the dev login, and prompts for the FAL key. Re-run it any time: it is
idempotent, it keeps your key, and it never resets a database you have been
working in. `pnpm local:reset` is the deliberate way to start over.

| Thing         | Where                                               |
| ------------- | --------------------------------------------------- |
| App           | http://localhost:3000                               |
| Sign in as    | `testuser@gmail.com` / `supa!1QAwsEDrf`             |
| MinIO console | http://localhost:9011 (`genzenlocal`/`genzenlocal`) |
| Postgres      | `postgres://genzen:genzen@localhost:5434/genzen`    |

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

| Path                     | What's there                                                                           |
| ------------------------ | -------------------------------------------------------------------------------------- |
| `src/features/<name>/`   | Domain modules. **Each has its own `CLAUDE.md` — read it before editing the feature.** |
| `src/lib/server/`        | Server-only helpers (files use `.server.ts` suffix).                                   |
| `src/components/`        | Primitives, one folder each, imported from the root barrel `#/components`.             |
| `app/api/`               | Route handlers (e.g. `app/api/fal-webhook/route.ts`).                                  |
| `migrations/`            | Numbered SQL migrations, applied by `pnpm db:migrate`.                                 |
| `CLAUDE.md`              | Feature catalog + service / convention notes.                                          |
| `docs/SPEC.md`           | What the app does and the rules that must hold.                                        |
| `docs/OVERVIEW.md`       | What genzen is, and what it deliberately is not.                                       |
| `docs/CODE-STANDARDS.md` | genzen's deltas from `~/repos/project-standard`.                                       |

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
Conventions follow `~/repos/project-standard`.

**Last shipped** (2026-07-29)

- **A canvas is a container, not a view (#212).** `canvases` + `canvas_images`,
  membership as rows with foreign keys, in four commits: add the tables, prove
  the two representations agreed, move the reads, drop `on_canvas`. Arrangement
  left IndexedDB, so it survives a different browser and a different machine.
  **The library owns everything** — a membership row is an arrangement over a
  library image, never exile. So **trashing no longer evicts from a canvas**:
  membership survives, the read filters `deleted_at`, and a restore returns the
  card to the same coordinates. The mount reconcile is gone, replaced by one
  rule — _place what is unplaced_ — because reclaim, prune and dedupe each became
  impossible rather than handled (`on delete cascade`,
  `unique (canvas_id, image_id)`). `page.tsx` reads on the server: no loading
  gate, no empty first paint. Deferred by decision: a guard for trashing an image
  that is on a canvas is **#216**, wanted only after living on the real canvas.
- **Origin is a column, and Images is scoped by it (#207).** `migrations/0003`
  adds `origin` — `upload | images | canvas` — `not null` with **no default**,
  so an insert that omits it fails instead of quietly meaning `images`; the
  required arg on `useGenerator` means the two hosts could not have compiled
  without declaring theirs. Backfilled from `source_client`, which one caller
  wrote and nothing read, and is no longer written. Origin records the surface
  only where the surface **authored** the thing, so a paste is an `upload`
  wherever it happened. Images now filters on it — Generations / Uploads /
  Canvas / All, default Generations, client-side because the route already holds
  every row — and making something widens the scope to where it landed. Also
  fixed the unpinned-generator toolbar defect that had been sitting in
  `images/CLAUDE.md`. **Scoping is not finding: #213 is.**
- **The insert-path inventory is written (#211).**
  `docs/reference/insert-paths.md`. **There are exactly two insert statements in
  the app** — one for generations, one for uploads — so every hole is a caller
  that did not pass a fact down, not an insert that forgot it. Four live creation
  paths, two moments per generation (reserve / settle, and a settle fact is
  absent for anything that fails). Three corrections to what the issue assumed:
  `parent_id` is **not** being written back (its branch is unreachable — no
  caller passes `parentImageId` since #204), `width`/`height`/`color_palette`
  have no writer in the app at all, and uploads sort last in SQL with
  `use-gallery.ts` quietly repairing it client-side. Filed #215 out of it.
- **Two data losses closed (#210).** Enhancing a prompt overwrote the one thing
  that cannot be re-derived: what you typed. It is now kept beside the enhanced
  text and written to `generation_metadata.original_prompt`, keyed by the
  enhanced string rather than by prompt index so editing the text invalidates the
  pair instead of attributing a stale original. Canvas's auto-prefixed submit
  records `typed_prompt` too, so the sent prompt and the typed prompt are both
  recoverable. A pasted source image was recorded as `has_source_image: true`; it
  now carries a sha256 and a byte count, and the buffer is decoded once for both
  the hash and the FAL upload. `docs/CODE-STANDARDS.md` states the rule behind
  it: unused code rots, unused data accrues.
- **Images has the route shape (#189, half).** Three commits, one job each:
  `page.tsx` reads on the server and seeds the view, killing the skeleton and
  the empty first paint; the 628-line `images-page.tsx` split into `view.tsx` +
  `use-view.ts` + four hooks and five components; then six component folders
  and three hooks came home from `(authenticated)/_components/` and
  `features/ai-images/`, which one route was importing. What is left in
  `_components/` is app chrome and the generator UI canvas also renders.
  Pixel diff against the old render: 0. **Canvas is the other half.**
- **The `/edit` route is gone, replaced by a highlight (#205).** Clicking a
  gallery image toggles a highlight; a highlighted image is the primary
  reference for whatever you prompt next. The prompt box is untouched by
  selecting. The generator already resolved the model's image-input endpoint
  from `!!sourceImage`, so "edit" stayed a detail of building the request
  rather than becoming a mode. 2,158 lines of route out, plus the whole
  `edit-image` server path and `useGenerationResults`; one flag in. A follow-up
  fixed the submit: a source image uploads to FAL as bytes like every other
  image, because handing FAL a URL to fetch cannot work against `localhost`.

**Up next — #209, the data model conformance pass.** A deliberate pivot on
2026-07-29.

The component pass (#186, #187, #189) settled how the app is _built_. This is
the same pass one layer down: how it **records what an image is**. Four facts
with four different mutabilities are collapsed into one JSONB bag and one
boolean — creation event (write-once), provenance (append-only), membership
(mutable), prompt lineage (append-only). Almost none of it is new data; it is
existing facts in the wrong shape, which is what separates this from
speculative schema work.

Read #209 for the four rules and the verification contract. Unlike the
component pass, none of this is `git revert`-able, so every change is
additive-then-subtractive and the drop is always its own late commit.

**Why bother:** #213 is the payoff, and it is the thing worth building. Read it
before starting — it is what the data work is _for_, and knowing that stops the
schema from drifting toward elegance.

Ordered (#210, #211, #207 and #212 done — the inventory the rest builds on is
`docs/reference/insert-paths.md`; #178 is superseded by #212 and can be closed):

1. **#189 — the canvas half of the route split**, now unblocked: the reconcile
   is already gone rather than carefully extracted and then deleted, and
   `page.tsx` already reads on the server. What is left is `view.tsx` +
   `use-view.ts` out of a 1,750-line component.
   `docs/reference/route-shape.md` is the contract and **Images is the closest
   worked example of it**; Trash is still the reference for the server seam.

**#213 — the ephemeral search overlay.** Command-F from anywhere, live filter
over prompts, take the prompt or the image, Escape and you are exactly where you
were. The principle is **don't break my flow — give me what I want and get out
of the way**, and it forbids more than it prescribes: no latency, no
round-tripping bytes on paste, no decisions on the way out, no residue.

Not a route. A locate-only _place_ failed here once (the squashed Uploads
section) and the reason was that it was a place you had to go — which breaks
flow by construction. Images stays a place to generate.

It is a front door, not a subsystem: all three of its actions already exist as
capabilities. Nothing blocks it any more — #210 gave it the prompt data and #212
gave "take me there" an address.

Deferred by decision, not oversight: **#208** (`image_edges`), a prompts table,
any `collections` generalization, a keep/favourite signal, and anything that
renders a graph. Each gets cheaper after #211; none gets more expensive by
waiting. The prompts table gets pulled forward when #213 needs a real index.

Also open, unsequenced:

- **#216 — trashing an image that is on the canvas is a silent surprise.** The
  arrangement is safe (#212 made restore lossless), but a card vanishes from a
  surface you were not looking at. A per-card "on canvas" marker is the
  load-bearing half; a confirm with deselect-by-default on batches is the rest.
  **Deliberately deferred until the canvas has been used for a while** — it is a
  judgement call about feel.
- **#214 — Retry drops the focus image.** A failed generation should re-send
  exactly what was sent; retry ignores `source_image_id` entirely and hands
  `source_image_url` to FAL as a URL, which cannot work locally. References
  already replay correctly. The pasted-source case is a decision (persist the
  bytes as a library row, or refuse honestly).
- **#215 — three upload implementations, one thumbnail.** Canvas paste/drop
  reaches the one that skips `createThumbnail`, so those rows render full-size
  in the gallery forever. From the #211 inventory.
- **#194 — canvas Undo does not restore.** Two faults: the client restore does
  not take, and `undo()` never reverses the server write. #212 settled what that
  write is — membership rows and positions — so this is now well-defined.
- **#188 — rewrite `docs/reference/architecture.md`.** It was waiting on #202,
  which is done.
- **#200** — hybrid Vercel/Railway topology exploration.

The app is four surfaces and nothing else: Images, Canvas, Activity, Trash —
plus Account. No assistant, no grouping, no separate edit page. If something
does not serve generating and keeping images, it was cut on purpose.
