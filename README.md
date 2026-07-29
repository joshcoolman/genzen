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

- **The component lane (#185) is done: `src/components/ui/` is 15 → 5.**
  `skeleton`, `textarea`, `popover` and `dropdown-menu` joined `badge`, `input`
  and `tooltip`; Radix is down to four files, three of them the dialog family.
  What's left is `dialog`, `button`, `alert-dialog`, `sheet` and `command` (cmdk,
  not Radix). Two rules came out of it: **a default that a call site will always
  override is a liability, not a convenience** — Popover ships with no width and
  no padding because a utility loses to an unlayered module and a module merely
  races it — and **a shared component that spreads `{...rest}` after its own
  `className` is a landmine**, since Base UI's `render` passes one where Radix's
  `asChild` never did.
- **`src/components/ui/` needed a component-first pass to shrink at all.** A
  route-driven pass never reaches the point where a shared component's file can
  be deleted, since "every consumer converted" is not a route's finish line —
  and both names cannot sit in the root barrel at once, so route-first quietly
  accumulates deep imports. Chasing a component's consumers is what flips the
  barrel. Dialog stays route-first for the opposite reason: its consumers hold
  all the hazards.
- **Mixed-library composition has a right nesting and a wrong one.** Radix
  `asChild` outside, Base UI `render` inside, one real element at the bottom —
  then both merge onto _it_ rather than onto each other's wrapper. The sidebar's
  Log out button is the worked example, and the sheet and alert-dialog clusters
  will hit it again.
- **#193 clusters 1-2 done, 6 of 19 dialog files.** The survey had
  `mobile-dialog-header` as the blocking leaf; the dependency runs the other way
  — `DialogTitle` wires `aria-labelledby`, so it must come from whichever
  library owns the surrounding Dialog, and its consumers are cluster 5. It flips
  with them, not before.
- **Every toast in the app was invisible, and now isn't (#192).** `<Toaster />`
  was mounted nowhere, so six `toast(...)` calls ran correctly and painted
  nothing — including the canvas Undo affordance. Probably lost in the TanStack
  → Next port. `toast/` also left `ui/`: it was never shadcn, and its 60 lines
  of inline hex became a CSS module on tokens. Mounting it exposed a second bug
  the silence had been hiding, #194 — that Undo does not restore.
- **Module-vs-module is decided by bundle order, and that is the new hazard.**
  A utility used to lose to a CSS module by layer; two modules each setting
  `color` on one class just race. The Canvas badge lost and rendered white
  instead of blue. `Badge` now takes colour through `--badge-color` /
  `--badge-border` — a custom property has no fight to lose. Prefer that over
  `composes:` when a component is coloured by its call site.

**Up next**

The component-first sub-lane is finished. #185 stays open for the routes that
still carry utility classes; #193 owns what is left of shadcn and Radix.

- **#193 — the dialog lane.** Route-first, because the hazards live in the call
  sites. Cluster 3 next — `generate-prompts`, `variation-prompts`,
  `failed-image-card` — which settles the inner-scroll recipe. No consumer
  anywhere uses a Radix escape hatch our `DialogContent` lacks. `sheet` and
  `alert-dialog` are the other two Radix files and belong to the same lane.
- **`Button` is the one to be careful with.** Its 12 call sites can flip any
  time, but `ui/button` cannot be deleted until `ui/dialog` and
  `ui/alert-dialog` stop importing it. Converting call sites and deleting the
  file are separate unlocks.
- **#194 — canvas Undo does not restore.** Two faults: the client restore does
  not take, and `undo()` never reverses the server write. Wants #189 first.
- **#189 — the oversized files**, `InfiniteCanvas.tsx` chief among them at 1764
  lines. A real refactor; deliberately after the mechanical pass.
- **#178 — canvas arrangement is not user data.** It still lives in IndexedDB;
  it belongs in Postgres now that there is a database the browser cannot reach.

The app is now five surfaces and nothing else: Images, Canvas, Activity, Trash,
Account — plus the AD assistant panel. If something does not serve generating
and keeping images, it was cut on purpose.
