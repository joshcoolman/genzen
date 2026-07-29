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
| UI          | CSS Modules + Base UI, migrating off Tailwind v4 / shadcn  |
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

**Last shipped** (2026-07-28)

- **Trash is converted, and it settled the seam (#185).** `page.tsx` is now a
  server component that runs the read and hands the payload to `view.tsx` as
  `initial` — bootsy's shape, written down in `docs/reference/route-shape.md`.
  The loading state stopped existing along with the empty first paint. The
  407-line `TrashDisplay` became five subject-named parts (`image-row`,
  `link-badge`, `empty-dialog`, `download-dialog`, `selection-bar`). Below the
  header the page diffs at max 2/255; the header moved on purpose, adopting the
  shared `PageHeader`.
  The trap it cost: a module rule is **unlayered**, so it outranks every utility
  it replaces and can override things that utility never could. `Button` sizes
  its own svg, so the `h-3 w-3` on each icon was already dead — restating it in
  a module would have shrunk icons the conversion was meant to leave alone.
- **`ImageBox`, and Base UI is in the repo (#185).** A square that shows an
  image and owns the four states it can be in — loading, loaded, failed, no
  file. Built on Base UI's `Avatar`, the first Base UI component here and the
  start of the migration off shadcn. It fixes a real bug: a trashed image whose
  object has gone away used to show a skeleton that pulsed forever, because
  nothing handled `onError`. Trash's row uses it, which made `Thumbnail`'s
  `layout="list"` branch dead — 45 lines and three props (`layout`, `footer`,
  `listImageClassName`) deleted, 31 props down to 28. Activity's two thumbnails
  took it next, at 48px and 64px: four hand-rolled image boxes down to two call
  sites, and three copies of a raw `hsl(0 0% 0%)` replaced by `--image-backing`.
  Activity's reference strip wants a _fluid_ square and did not fit, which is
  the primitive holding its shape rather than a gap to close.
- **`ConfirmDialog` (#185).** Nine imports and ~28 lines of `AlertDialog`
  nesting were repeated verbatim at five call sites, varying only in their
  strings — three of them written during the Trash conversion itself. Now five
  props, with the trigger as `children`. 162 lines out, 89 in. Sidebar keeps
  composing by hand; it wraps its trigger in a Tooltip, and bending the
  primitive for one case is how the last one reached 31 props.
- **Account and Login are in the route shape too (#185).** Both were off
  Tailwind but not in the shape, which made them a second dialect beside the
  reference. Zero diff each. Login forced a fix to
  `docs/reference/route-shape.md`: the tree listed a `view.module.css` the rules
  forbade, and a frame that carries design (Login's centred column) becomes a
  named component instead.
- **Activity is the reference shape (#185).** `page.tsx` renders `view.tsx`,
  which composes components and carries no styles of its own; `use-view.ts`
  holds the state. Parts are named by subject (`run-row`, `totals`, `filters`),
  never by route. Written down once in `docs/reference/route-shape.md` — copy
  Activity, not an older route. Five primitives fell out of doing it, now flat
  in `src/components/` alongside everything else.
- **Activity is also simpler.** Model chips, the date filters, the stat grid and
  the cost badge are gone; the log is windowed to the last three days that
  produced runs, so the 5,000-row totals query went with them. What is left is a
  title, a Models multi-select, a state filter and the table.

**Up next**

- **#185 — Pass 2: styling.** L0/L1 are in; conversion runs area by area to CSS
  Modules, with Base UI replacing shadcn as each component is touched. Tailwind
  comes out last (#186). Login, Settings, Account, Activity and Trash are done.
  What is left is effectively one surface — `src/components/` + the Images
  cluster in `_components/` + `/images`. 52 files still carry utility classes,
  and the shared list components (`Thumbnail`, `ImageGrid`, `SelectionDrawer`)
  are the knot in the middle of it: four routes render them.
- **#189 — the oversized files**, `InfiniteCanvas.tsx` chief among them at 1764
  lines. A real refactor; deliberately after the mechanical pass.
- **#178 — canvas arrangement is not user data.** It still lives in IndexedDB;
  it belongs in Postgres now that there is a database the browser cannot reach.

The app is now five surfaces and nothing else: Images, Canvas, Activity, Trash,
Account — plus the AD assistant panel. If something does not serve generating
and keeping images, it was cut on purpose.
