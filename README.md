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

- **Tailwind is gone, and #187 closed with it.** The reset swap was the whole
  job: dropping `@import 'tailwindcss'` took Preflight, so `styles/base.css`
  switched on in the same commit. `src/styles.css` is two imports now. Also out:
  `postcss.config.mjs`, `components.json`, `.cta.json`, and `cn()`. One utility
  line had survived #185 — the canvas spinner — and is converted; the tree is
  genuinely at zero.
- **The Edit route has the route shape (#189).** `page.tsx` → `view.tsx` +
  `use-view.ts`, and the 677-line `edit-page.tsx` is five components and three
  subject-named hooks. The generator dock is the concrete win: the mobile
  dialog and the desktop sidebar rendered the same panel from two copies of the
  markup. Chrome is byte-identical to the old build, pixel for pixel, with
  image content masked.
- **A render loop on Edit that predated the refactor.** Sorting ascending
  rebuilt the chain array every render, and an effect mirroring it into
  selection state set state every render — forever. Reproduced on the commit
  before the conversion, so it was there all along; the sort toggle persists,
  so anyone who had pressed it once kept it. The page renders correctly while
  looping, which is why only the console caught it.
- **`EmptyState` is the seventh primitive.** Edit's "Image not found" and the
  gallery's "No images yet" were byte-identical CSS — the bar `route-shape.md`
  sets for extracting one.
- **No `.tsx` in the app carries a utility class (#185)**, except
  `infinite-canvas.tsx`, which is left for #189 rather than converted twice.
  35 files: every `src/components/` primitive, all of the app chrome, the AD
  panel, and the Images and Edit routes. Each area was diffed against a stashed
  baseline at 1440×1600 — the largest surviving difference is 11 pixels of
  antialiasing on /edit.
- **Two bugs the conversion surfaced.** `ExpandableText` never clamped —
  `line-clamp-${lines}` is an interpolated class Tailwind's scanner cannot see,
  so no rule existed and every description rendered full-length. And
  `space-y-*` is emitted inside `:where()`, so a child's own margin beats it;
  converting it to a plain child selector inverts that and moved the sidebar.
- **`src/components/ui/` is gone entirely.** The Cmd+K Spotlight was never used,
  so deleting it took `cmdk` — the last thing in `ui/` — with it. The AD panel's
  Agent Skills popover used the command primitives for nothing (four skills, and
  the search input only mounts at six), so it is four buttons now. Closes #195.

**Up next**

- **#202 — strip back to generating images.** The epic that came out of
  converting Edit and then reading the result. Three removals, in order:
  **#203** the AD assistant and BYOK, **#204** grouping and genealogy, then
  **#205** the `/edit` route, replaced by a highlight on /images that makes an
  image the reference for the next prompt. About a quarter of the codebase, and
  the quarter that raises structural questions rather than generating images.
- **#189 — route shape for Images and Canvas.** Edit is out of scope now; it is
  being deleted rather than converted. Do the removals first.
- **#194 — canvas Undo does not restore.** Two faults: the client restore does
  not take, and `undo()` never reverses the server write.
- **#178 — canvas arrangement is not user data.** It still lives in IndexedDB;
  it belongs in Postgres now that there is a database the browser cannot reach.

The app is heading for four surfaces and nothing else: Images, Canvas,
Activity, Trash — plus Account. No assistant, no grouping, no separate edit
page. If something does not serve generating and keeping images, it is being
cut on purpose.
