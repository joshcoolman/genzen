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
- **Grouping and genealogy are out (#204).** Deleting an image deletes that
  image -- it used to be a decision about a subtree, hiding a row rather than
  soft-deleting it so its variations kept an origin thumbnail, then destroying
  the hidden row later. Cards render one image. Trash's "N linked" is gone;
  canvas membership is the only living dependency left. Migration 0002 drops
  `hidden` and strips `parent_id`.
- **The AD assistant and BYOK are out (#203).** Never used, and making it
  useful was a rabbit hole. The status bar went with it -- its only control was
  the chat toggle. Server-side Anthropic stays for prompt work. Closed #201 too.
- **Tailwind is gone, and #187 closed with it.** The reset swap was the whole
  job: dropping `@import 'tailwindcss'` took Preflight, so `styles/base.css`
  switched on in the same commit. `src/styles.css` is two imports now. Also out:
  `postcss.config.mjs`, `components.json`, `.cta.json`, and `cn()`.
- **A render loop on Edit that predated its refactor.** Sorting ascending
  rebuilt the chain array every render, and an effect mirroring it into
  selection state set state every render — forever. The page rendered correctly
  while looping, which is why only the console caught it.

**Up next**

**#189 — Canvas, the other half.** This is the whole priority; everything below
it waits.

`docs/reference/route-shape.md` is the contract. **Images is now the closest
worked example of it** — a real view with dialogs, persisted prefs and a
generator panel — and Trash is still the reference for the server seam.

`infinite-canvas.tsx` is 1,760 lines and `use-canvas-generate.ts` is 577. This
is the actual monolith: pan/zoom, drag-move, marquee selection, undo/redo,
paste/drop upload, context menu, library picker and the mount-time reconcile,
in one component. Split by concern (viewport, selection, undo, ingest,
reconcile), not by line count.

While in there: unpinning the generator on Images hides the toolbar's own
controls — the workspace stops being pushed, so the right-aligned tools end up
under the floating panel. Predates #189 and is noted in `images/CLAUDE.md`.

Then, in no fixed order:

- **#194 — canvas Undo does not restore.** Two faults: the client restore does
  not take, and `undo()` never reverses the server write.
- **#178 — canvas arrangement is not user data.** It still lives in IndexedDB;
  it belongs in Postgres now that there is a database the browser cannot reach.
- **#188 — rewrite `docs/reference/architecture.md`.** It was waiting on #202,
  which is done.
- **#207 / #208 — image origin and provenance.** Filed, not triaged. #208 is
  not a reversal of #204: `source_image_id` and `root_image_id` are still
  recorded on every generation, so it builds a graph over facts already there.
  What #204 removed was `parent_id`, the mutable grouping parent.

The app is four surfaces and nothing else: Images, Canvas, Activity, Trash —
plus Account. No assistant, no grouping, no separate edit page. If something
does not serve generating and keeping images, it was cut on purpose.
