# GenZen

A personal workspace for working with AI image models. Fan one prompt across
several models and compare side by side, run non-destructive edit and variation
flows, and arrange results on an infinite canvas.

This is a tool I built for myself and use. It is public because there's no reason
for it not to be — not because it's a product. There's no signup, no billing, no
support, no roadmap. MIT licensed; fork it and make it yours.

**Up next.** Substrate first, then the finish state agreed in #222. This one is
ahead of the feature work on purpose: its cost grows with every commit.

1. **#227** — the rest of it: write down what a deployment needs, and state the
   local-must-not-diverge rule where it binds. CI landed; the docs half has not.

Then the finish state (2–4 are small and order-flexible; the issues hold the detail):

2. **#216** — Passive "on canvas" marker in library
3. **#188** — Rewrite the architecture doc
4. **#194** — Fix Canvas Undo (unblocked: #189 landed)
5. **#213** — Ephemeral search overlay: my stuff, fast, without breaking flow — the payoff

Parked, outside the finish state: **#223**, a proposal for an AI policy seam.
Worth a read before it ages — it documents a real hole (the model id is a bare
client string and `endpointFor` passes an unknown one straight through), so it
is a decision rather than an idea.

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
which is also the whole password-reset story. `pnpm auth:create-user` is the
path for an additional or non-local account.

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
| `pnpm check:claude-md`  | What the pre-commit hook checks (advisory)  |

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

| Path                     | What's there                                                                              |
| ------------------------ | ----------------------------------------------------------------------------------------- |
| `src/features/<name>/`   | Domain modules. **Each has its own `CLAUDE.md` — read it before editing the feature.**    |
| `src/lib/server/`        | Server-only helpers (files use `.server.ts` suffix).                                      |
| `src/components/`        | Primitives, one folder each, imported from the root barrel `#/components`.                |
| `app/api/`               | Route handlers (e.g. `app/api/fal-webhook/route.ts`).                                     |
| `migrations/`            | Numbered SQL migrations, applied by `pnpm db:migrate`.                                    |
| `CLAUDE.md`              | Feature catalog + service / convention notes.                                             |
| `docs/SPEC.md`           | What the app does and the rules that must hold.                                           |
| `docs/OVERVIEW.md`       | What genzen is, and what it deliberately is not.                                          |
| `docs/CODE-STANDARDS.md` | genzen's deltas from [project-standard](https://github.com/joshcoolman/project-standard). |

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
Conventions follow [project-standard](https://github.com/joshcoolman/project-standard).
GenZen is public-and-messy on purpose: the exploration home where ideas are tried
in the open, on a clean substrate; bootsy consolidates what proves out (#222).

**Last shipped** (2026-07-30)

- **CI exists, and it boots the production server (#227, part).** `check`/`typecheck`/`test`/`build` on push and PR, plus the one nobody runs locally: `pnpm start` answering `/login`. A passing build is not the same claim as "it starts" — which is exactly how the dead Dockerfile survived the Next conversion.
- **Storage went private; the app serves its own images (#226).** Every image used to sit at an unauthenticated URL — a locked front door on a building with open windows. Now `/img/[id]` checks the session and the row's `user_id`, `src/lib/image-url.ts` is the only place a URL is built, and the local bucket is private too so local cannot drift from a deployment.
- **The repo stopped advertising a stack it does not have (#225).** trigger.dev's MCP server, a `Dockerfile` that built green and could not boot, and a reset header claiming Tailwind still owned it. A cold read now lands on the truth: Next, Postgres, MinIO, and no deployment anywhere.
- **`user_id` scoping is checked, not remembered (#219).** An ESLint rule fails any `sql` statement naming a user-scoped table without a `user_id`; the table list comes from the migrations, so a new table is covered the day it lands. Found 10 unscoped statements — all legitimate, three of which now carry a real filter anyway.
- **A canvas paste draws before it uploads.** The clipboard already handed over the bytes, so the card renders from them at ~30ms — right size, right place — and the upload runs underneath. `uploading` is a distinct state from `pending`: one has a picture, the other has nothing to show.
- **One way into the library (#215).** Three near-identical upload functions, one of them dead, and only one made a thumbnail — so whether the grid downloaded full-size objects came down to which caller you went through. `saveFileToLibrary` is now the single writer and owns the thumbnail.
- **An attached source image is saved on arrival (#224).** Uploading into the generator used to hold the bytes in memory, so its generation could never be retried. Settled the rule: aggressive on bytes, submit-only on prompt text.

**Up next** — the ordered list lives at the top of this file, so the front door
carries it. It is the open issues, in execution order.

After #213: the grouping spike (focus, not taxonomy — not #204's grouping). Agent-facing
designs are parked as prose in `docs/reference/agent-substrate.md`.

**Deployment is undecided in scope, decided in provider.** genzen has never been
deployed; MinIO and Docker Postgres are the only environment it has run in, and
the `R2_*` env names describe an intention rather than an account. The hybrid
Vercel/Railway split explored in #200 is dead — one provider, Railway, when it
ships. Its provisioning is fully agent-drivable, which is the whole reason.

The app is four surfaces and nothing else: Images, Canvas, Activity, Trash — plus
Account. No assistant, no image grouping (canvas's spatial groups are a different
thing and are alive), no separate edit page. If something does not serve
generating and keeping images, it was cut on purpose.
