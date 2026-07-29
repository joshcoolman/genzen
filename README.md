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
| UI          | CSS Modules + Base UI; Tailwind v4 still on routes         |
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

- **shadcn and Radix are out of the app (#193).** `src/components/ui/` is one
  folder — `command`, which is cmdk. Dialog, Sheet, AlertDialog and Button are
  ours on Base UI, and `radix-ui` is uninstalled. `ui/command` was never the
  blocker it was filed as: cmdk is not Radix, and its only tie to the old
  primitive was one `DialogContent` import.
- **The rule the whole conversion came down to: a property the call site sets is
  a custom property, not a class it re-declares.** Two CSS modules setting
  `max-width` on one element race on bundle order. `DialogContent` takes
  `--dialog-max-width` / `--dialog-max-height` / `--dialog-overflow` /
  `--dialog-padding` / `--dialog-title-color`; Sheet takes `--sheet-*`. Repeated
  _shapes_ became props rather than components — `size="wide"`,
  `size="fullscreen"`, and `ConfirmDialog`'s `choices`.
- **The inner-scroll recipe, used five times:** `--dialog-overflow: hidden` on
  the popup, then `overflow-y: auto` **and `min-height: 0`** on the scrolling
  child. Without the min-height a flex item's minimum size is its content, so
  the popup grows past its own max-height instead of the list scrolling.
- **`autoFocus` inside a focus trap is a silent no-op.** The download-name field
  would have come up unfocused with its Enter-to-download path unreachable.
  Base UI wants the control named by ref (`initialFocus`).
- **The component lane (#185) is done: `src/components/ui/` went 15 → 1.**
  `skeleton`, `textarea`, `popover`, `dropdown-menu`, `badge`, `input`,
  `tooltip`. A shared component that spreads `{...rest}` after its own
  `className` is a landmine: Base UI's `render` passes one where Radix's
  `asChild` never did.
- **Every toast in the app was invisible, and now isn't (#192).** `<Toaster />`
  was mounted nowhere, so six `toast(...)` calls ran correctly and painted
  nothing — including the canvas Undo affordance. Mounting it exposed a second
  bug the silence had been hiding, #194 — that Undo does not restore.

**Up next**

- **#185 — what's left of the styling pass is routes, not components.** 60-odd
  `.tsx` files still carry utility classes; the primitives underneath them are
  all ours now. `ui/command` and `Thumbnail` are the two that convert with their
  own consumers rather than ahead of them.
- **#194 — canvas Undo does not restore.** Two faults: the client restore does
  not take, and `undo()` never reverses the server write. Wants #189 first.
- **#189 — the oversized files**, `InfiniteCanvas.tsx` chief among them at 1764
  lines. A real refactor; deliberately after the mechanical pass.
- **#178 — canvas arrangement is not user data.** It still lives in IndexedDB;
  it belongs in Postgres now that there is a database the browser cannot reach.
- **#195 — Spotlight offers a Docs route that was deleted.** One line.

The app is now five surfaces and nothing else: Images, Canvas, Activity, Trash,
Account — plus the AD assistant panel. If something does not serve generating
and keeping images, it was cut on purpose.
