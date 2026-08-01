# GenZen

A personal workspace for working with AI image models. Fan one prompt across
several models and compare side by side, run non-destructive edit and variation
flows, and arrange results on an infinite canvas.

This is a tool I built for myself and use. It is public because there's no reason
for it not to be — not because it's a product. There's no signup, no billing, no
support, no roadmap. MIT licensed; fork it and make it yours.

**Up next.** The hygiene run is done — the token collapse (#229), the confirm
removal (#236) and the drift audit (#228) all closed, so `no-raw-color.js` has
no exemptions and no doc, config file or dependency names a tool this repo does
not use. What is left is the deployment: two naming decisions taken while they
are still free, then the deploy itself. In this order.

1. **#242** — rename `R2_*` to Railway's `BUCKET_*`. The prefix describes an
   intention rather than an account, and the rename is free only while nothing
   is deployed. The day step 3 ships it becomes a dashboard edit, a deploy, and
   a window where two names disagree.
2. **#241** — decide what `.server.ts` means. Today it means two opposite
   things: `db.server.ts` cannot be imported from client code, and fourteen
   client modules import `.server.ts` action files because that is the point.
   The import line does not say which. Same reason as above for doing it now —
   a mechanical rename is cheap until it is competing with a deploy for
   attention.
3. **#227** — the rest of deployability. CI landed and boots the production
   server; what has not is deployment-as-code. `pnpm start` hardcodes
   `--port 3000` while the platform injects `PORT`, so today the config would
   have to live in a Railway setting instead of the repo — the exact shape of
   rot this issue exists to stop. Write the env contract and the
   local-must-not-diverge list, then **deploy once to prove it**, look at it, and
   tear it down. The property is reproducibility, not durability: nothing has to
   survive teardown, but redeploying tomorrow has to land in the same place
   without anyone remembering a step. Railway is the provider; `bootsy` is
   already there as a worked example.

**Not immediately** — captured, and worth reading before acting on any of them.
**#234**, canvas arrival sizing: an observation, not a diagnosis, and it needs
reproducing before anyone picks a rule. **#237**, a generated "recently changed"
block for this file, which argues honestly against itself via #217 and may want
to be a command rather than a document. **#223**, a proposal for an AI policy
seam, worth a read before it ages because it documents a real hole — the model
id is a bare client string and `endpointFor` passes an unknown one straight
through.

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

| Command                 | Purpose                                                   |
| ----------------------- | --------------------------------------------------------- |
| `pnpm local:up`         | Start the local stack, write `.env.local`                 |
| `pnpm local:down`       | Stop it (data kept)                                       |
| `pnpm local:reset`      | Stop it and delete the volumes                            |
| `pnpm dev`              | Next dev server on :3000                                  |
| `pnpm build`            | Production build                                          |
| `pnpm test`             | Vitest                                                    |
| `pnpm check`            | Prettier + ESLint --fix + color check (run before commit) |
| `pnpm check:colors`     | Fail on a raw color outside `tokens.css`                  |
| `pnpm typecheck`        | `tsc --noEmit` (the build typechecks too)                 |
| `pnpm db:migrate`       | Apply pending `migrations/*.sql`                          |
| `pnpm auth:create-user` | Create a user, or reset one's password                    |
| `pnpm check:claude-md`  | What the pre-commit hook checks (advisory)                |

## Stack

| Layer       | Tech                                                       |
| ----------- | ---------------------------------------------------------- |
| App         | Next.js App Router (React 19 + Turbopack)                  |
| UI          | CSS Modules + Base UI, on the tokens in `src/styles/`      |
| Data        | Postgres, queried with SQL via `postgres` (no ORM)         |
| Auth        | scrypt + signed session cookie, own `users` table          |
| Storage     | S3 — MinIO locally; no deployment, so no provider chosen   |
| Images      | FAL                                                        |
| Text/vision | Anthropic (assistant, prompt work), Google Gemini (vision) |

## Repo map

| Path                   | What's there                                                                              |
| ---------------------- | ----------------------------------------------------------------------------------------- |
| `src/features/<name>/` | Domain modules. **Each has its own `CLAUDE.md` — read it before editing the feature.**    |
| `src/lib/server/`      | Server-only helpers (files use `.server.ts` suffix).                                      |
| `src/components/`      | Primitives, one folder each, imported from the root barrel `#/components`.                |
| `app/api/`             | Route handlers (e.g. `app/api/fal-webhook/route.ts`).                                     |
| `migrations/`          | Numbered SQL migrations, applied by `pnpm db:migrate`.                                    |
| `CLAUDE.md`            | Feature catalog + service / convention notes.                                             |
| `docs/SPEC.md`         | What the app does and the rules that must hold.                                           |
| `docs/OVERVIEW.md`     | What genzen is, and what it deliberately is not.                                          |
| `docs/DELTAS.md`       | genzen's deltas from [project-standard](https://github.com/joshcoolman/project-standard). |

## Env

**Locally there is nothing to configure.** `pnpm local:up` writes `.env.local`
itself and prompts you for the one value that is actually yours, the FAL key.

`.env.example` is the reference for deploying, split into Required (a Postgres
URL, a session secret, FAL, an S3 bucket) and Optional (Anthropic, Gemini, FAL
webhooks).

One note if you deploy: the `R2_*` names are historical and the storage layer
is plain S3, pointing wherever `R2_ENDPOINT` says. **The bucket must be private**
(#226) — the app serves images itself. Leave `R2_ENDPOINT` unset and set
`R2_ACCOUNT_ID` only if you want Cloudflare R2's endpoint derived.

Provider keys are server-only. Only `NEXT_PUBLIC_*` reaches the browser — Next
inlines nothing else, and the `VITE_` prefix carries no meaning here (#225).

## Conventions / gotchas

- Route protection is deny-by-default in `proxy.ts` — a new public path must be listed in its `PUBLIC_PATHS`.
- No Tailwind and no CSS framework. `src/styles/tokens.css` is the token layer,
  `src/styles/base.css` the reset; everything else is a `.module.css` beside its
  component. `src/styles.css` imports those two and nothing else. Colors live
  in `tokens.css` alone — `pnpm check:colors` enforces it (#229).
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

**Last shipped** (2026-08-01)

- **The repo stopped claiming things that were not true (#228).** Five parallel audits found the pattern worth keeping: every claim something enforced held, and every claim only prose asserted had drifted. So a doc prescribing the inverse of the live rule is gone, nine unused dependencies and six config files describing removed toolchains are gone, the React logo a scaffold left in `public/` is gone, and four names that made `grep` lie were disambiguated.
- **Nothing reversible asks first (#236).** Trash is a soft delete and a place you can visit tomorrow — that _is_ the confirmation, so the canvas delete dialog and the undo toasts went, and Remove from Canvas went with them rather than earn an exception. The only interruptions left are Trash's three permanent deletes, and nothing silences them. 332 lines deleted against 67 added.
- **The token core is done, and nothing is exempt from it (#229).** Canvas was the last subtree authoring its own colors — 61 of them, 15 greys collapsing to 5 and four accents to one, so selection chrome is the app's green now. Its eleven `font-family` declarations went too, deleted rather than retokenised: `base.css` already sets the face on `html` and resets form controls, so the right count below it is zero. `eslint-rules/no-raw-color.js` has no allowlist left.
- **Cmd-F finds your stuff, and gets out of the way (#213).** An overlay over whatever you were doing: everything, newest first, the prompt you typed shown whole beside its thumbnail, live filtering and All / Generations / Uploads. Two things come out — the prompt to the clipboard, and the image as a _reference_: the clipboard carries the record id, so pasting it on Images adds it to the reference strip and on Canvas drops a card, with no upload and no second row. Escape leaves nothing behind. It is deliberately not a place: no route, no location on a row, nothing to navigate into.
- **CI exists, and it boots the production server (#227, part).** `check`/`typecheck`/`test`/`build` on push and PR, plus the one nobody runs locally: `pnpm start` answering `/login`. A passing build is not the same claim as "it starts" — which is exactly how the dead Dockerfile survived the Next conversion.
- **Storage went private; the app serves its own images (#226).** Every image used to sit at an unauthenticated URL — a locked front door on a building with open windows. Now `/img/[id]` checks the session and the row's `user_id`, `src/lib/image-url.ts` is the only place a URL is built, and the local bucket is private too so local cannot drift from a deployment.

**Up next** — the ordered list lives at the top of this file, so the front door
carries it. It is the open issues, in execution order: the two naming decisions
while they are still free (#242, #241), then deploy once to prove it repeats
(#227). Everything else is captured, not scheduled.

Agent-facing designs are parked as prose in `docs/reference/agent-substrate.md`;
the grouping spike (focus, not taxonomy — not #204's grouping) has no issue yet.

**Deployment: decided in provider, scheduled as #227.** genzen has never been
deployed; MinIO and Docker Postgres are the only environment it has run in, and
the `R2_*` env names describe an intention rather than an account. The hybrid
Vercel/Railway split explored in #200 is dead — one provider, Railway, and its
provisioning is fully agent-drivable, which is the whole reason. The goal is not
to run it in the cloud: it is that deploying, tearing down and redeploying stays
cheap, and that a local run does not behave differently from a deployed one.
Building features without that property is how it quietly stops being true.

The app is four surfaces and nothing else: Images, Canvas, Activity, Trash — plus
Account. No assistant, no image grouping (canvas's spatial groups are a different
thing and are alive), no separate edit page. If something does not serve
generating and keeping images, it was cut on purpose.
