# GenZen

A personal workspace for working with AI image models. Fan one prompt across
several models and compare side by side, run non-destructive edit / variation
flows that track parent→child genealogy, arrange results on an infinite canvas,
and ask an in-app assistant about your library.

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

| Command                             | Purpose                                     |
| ----------------------------------- | ------------------------------------------- |
| `pnpm local:up`                     | Start the local stack, write `.env.local`   |
| `pnpm local:down`                   | Stop it (data kept)                         |
| `pnpm local:reset`                  | Stop it and delete the volumes              |
| `pnpm dev`                          | Next dev server on :3000                    |
| `pnpm build`                        | Production build                            |
| `pnpm test`                         | Vitest                                      |
| `pnpm check`                        | Prettier + ESLint --fix (run before commit) |
| `pnpm typecheck`                    | `tsc --noEmit` (the build typechecks too)   |
| `pnpm db:migrate`                   | Apply pending `migrations/*.sql`            |
| `pnpm auth:create-user`             | Create a user, or reset one's password      |
| `npx shadcn@latest add <component>` | Add a shadcn component                      |

## Stack

| Layer       | Tech                                                       |
| ----------- | ---------------------------------------------------------- |
| App         | Next.js App Router (React 19 + Turbopack)                  |
| UI          | Tailwind v4 (CSS config in `src/styles.css`) + shadcn/ui   |
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
- Tailwind v4 has no `tailwind.config.*`; theme lives in `src/styles.css`.
- Server-only code uses the `.server.ts` suffix; do not import it from client code.
- FAL generation status is reconciled via on-demand polling in `src/lib/server/check-pending-generations.server.ts`. Webhooks are optional and gated by env.
- S3 public URLs do not expire — safe to persist in DB rows.
- Every generate path reserves its `user_images` row _before_ any fallible work,
  so a click always leaves a card behind — pending, completed, or failed with a
  reason and a Retry.

## Status

Orientation lives here and in open issues — there is no continuation or plan file.
Conventions follow `~/repos/project-standard`.

**Last shipped** (2026-07-27)

- **The Settings page is gone.** The lineup is the offer — what is in
  `IMAGE_MODELS` is what every selector shows, one to one — so there was nothing
  left for it to do. All three of its sections turned out to be nothing: Text
  toggled models no code path could reach, Sidebar hid items from a sidebar
  that is now fixed, Models subtracted from the registry that is now the single
  source of truth. `use-enabled-models` went with it deliberately: it stored
  _disabled_ ids, so leaving the hook alive would have hidden models with no UI
  left to restore them.
- **One source of truth for image models (#190).** `IMAGE_MODELS` is the whole
  lineup — one entry per model, one name over up to two FAL endpoints
  (`textToImage` / `withImages`), routed by `endpointFor(id, hasImage)`. The
  five-places-per-model sprawl is gone, along with `ALL_IMAGE_MODELS`,
  `EDIT_MODELS`, nine dead exports and the hardcoded Kontext branch. Adding a
  model is one object literal; removing one is deleting it plus a line in
  `RETIRED_MODEL_NAMES`.
- **Settings and Images show the same seven models (#190).** Cut FLUX Schnell,
  FLUX Dev, both Klings, Recraft V3 and Grok Imagine — none had an image
  endpoint wired, and they were the whole 13-vs-7 discrepancy. FLUX Dev stays
  reachable as Kontext Dev's text-only routing target. Settings also lost its
  Text and Sidebar sections; the sidebar is a fixed set now.
- **Login and Settings are off Tailwind (#185).** First two areas of Pass 2;
  81 files to go. Both surfaced traps now written down on the issue: `text-sm`
  carries a line-height (L0 pairs `--text-*-leading` with every size), and
  `space-y-*` is not always flex + gap (an inline-block child needs the block
  container's line box). Each verified by pixel diff across a stash.
- **Styling L0/L1 landed (#183).** `src/styles/tokens.css` is the single source
  of values — the whole `:root` block out of `styles.css`, hex to HSL, plus the
  tokens Tailwind supplied implicitly (status, scrim, on-dark, shadows, spacing,
  radii, type, z-index). `styles/base.css` is written but not imported;
  Preflight still owns the reset until #186. Verified by diffing compiled CSS:
  every changed line is a token declaration, no rule moved.
- **The Images page is `/images`, not `/ai-images`.** Its query is
  `source in ('upload', 'ai_generated')` -- it always listed uploads beside
  generations, and an upload is routinely the root of a family of them. The
  name described the Generate panel, not the grid it sat over. The panel is
  dismissible; the grid is the page.

**Up next**

- **#185 — Pass 2: styling.** L0/L1 are in; next is converting area by area to
  CSS Modules, with Base UI replacing shadcn as each component is touched.
  Tailwind comes out last (#186). Login and Settings are done; 81 files still
  carry utility classes.
- **#189 — the oversized files**, `InfiniteCanvas.tsx` chief among them at 1764
  lines. A real refactor; deliberately after the mechanical pass.
- **#178 — canvas arrangement is not user data.** It still lives in IndexedDB;
  it belongs in Postgres now that there is a database the browser cannot reach.

The app is now five surfaces and nothing else: Images, Canvas, Activity, Trash,
Account — plus the AD assistant panel. If something does not serve generating
and keeping images, it was cut on purpose.
