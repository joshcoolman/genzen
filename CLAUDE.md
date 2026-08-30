Next.js App Router (React 19 + Turbopack), Postgres, FAL AI (image gen), CSS Modules + Base UI (no Tailwind, no CSS framework)

## Commands

- `pnpm check` -- prettier, eslint fix, and the colour and token checks (run before commit)
- `pnpm build` -- production build (run after check, before commit)
- `pnpm test` -- vitest

## Structure

- `app/` -- App Router routes (`_actions/ _components/` per route folder).
  `(authenticated)/` is a route group: a layout boundary that contributes
  nothing to the URL, so `/images`, `/canvas` etc. are top-level paths.
  It is not the gate -- `proxy.ts` is
- `src/features/` -- headless domain modules, **each has its own CLAUDE.md -- read it before working on a feature**
- `src/lib/server/` -- `.server.ts` is never importable from the client;
  `.action.ts` is a `'use server'` module that is (#241, lint-enforced)
- `src/components/` -- primitives, one folder per component, imported from the
  single root barrel `#/components`. Hand-rolled or on Base UI; there is no
  shadcn set left, no `ui/` folder, and no Radix
- `migrations/` -- numbered SQL migrations, applied by `pnpm db:migrate`

## Services

Local dev is one command: **`pnpm local:up`** (Postgres + MinIO + schema + a
populated `.env.local`), then `pnpm dev`. Docker, pnpm and Node 22.13+ are the
only prerequisites.

genzen is also deployed — Railway, one service plus Postgres and a private
bucket. `docs/deploying.md` is the contract; do not re-derive it. Logins on any
database, local or deployed, are managed with `pnpm users` (`-h` for usage). It is idempotent and never resets a database you have been
working in. The only keys a human supplies are `FAL_KEY` and, if the AI-assisted
features are wanted, `ANTHROPIC_API_KEY` -- `local:up` prompts for each that is
missing and the app runs without the second. Everything else is a
container or a fixed local value. See the README's Local Dev section.

Assume server-side access to the services below unless a feature explicitly says
otherwise. Don't propose new auth/env plumbing for these. Note that locally the
optional Anthropic key is usually **empty** — the app runs fine without it, so a
feature that needs it should fail loudly rather than assume it's there.

- **Anthropic** (`ANTHROPIC_API_KEY`) — Claude, server-side only, and the only text/vision provider: prompt enhancement, variation prompts, Describe/Caption. There is no browser-held key. FAL is the only image provider.
- **FAL AI** (`FAL_KEY`) — image generation via `@fal-ai/client`.
- **Postgres** (`DATABASE_URL`) — the database, reached only through `sql` from `src/lib/server/db.server.ts`. There is no ORM and no query builder; server code writes SQL. There is also no RLS: `sql` connects as the owning role, so **every read and write carries an explicit `user_id` filter**, taken from `resolveAuth()` and never from the caller. That is checked, not remembered: `eslint-rules/sql-user-scoping.js` fails any `sql` statement naming a user-scoped table without one (#219). The tables come from the migrations, so a new one is covered the day it lands. Where an id is genuinely server-derived, annotate the statement `// sql-scope-exempt: <why>` — a reason is required, and `grep sql-scope-exempt` is the list of every place the rule is knowingly bent. Row shapes are `src/lib/types/db.ts`, paired with the select list in `src/lib/server/user-image-columns.server.ts` — a test fails if either drifts from `migrations/0001_init.sql`.
- **S3 storage** (`R2_*`) — image/asset storage. `src/lib/image-storage.ts` is a
  provider-agnostic S3 client pointed by `R2_ENDPOINT`; the `R2_` prefix is
  historical and Cloudflare-specific plumbing (`R2_ACCOUNT_ID`) is a leftover of
  it. The prefix is staying: #242 proposed renaming it to `BUCKET_*` and was
  closed once a deployment existed, since the rename buys nothing but costs a
  live variable change. **Cloudflare R2 is still not in use anywhere** — locally
  it is MinIO in Docker, and in production it is a Railway bucket. A doc or
  memory claiming R2 is the provider is wrong (#225).
  **The bucket is private** (#226), locally too. Nothing reads an object without
  credentials: the browser gets images from `/img/[id]`, which resolves identity
  from the cookie and filters the row by `user_id`. `src/lib/image-url.ts` is the
  only place a URL is built — two surfaces used to concatenate one by hand, so a
  change to the scheme silently missed them. Server code that needs bytes
  (FAL uploads, vision) calls `storage.download()` and never HTTP.

## Features

**`src/features/` — domain code two or more routes need.** A folder here is
earned; see `docs/DELTAS.md`.

| Feature     | Description                                                          | CLAUDE.md                            |
| ----------- | -------------------------------------------------------------------- | ------------------------------------ |
| activity    | Chronological cost/time log of every generation (inc failures)       | `src/features/activity/CLAUDE.md`    |
| ai-images   | Multi-model image generation, edit, variation workflows              | `src/features/ai-images/CLAUDE.md`   |
| auth        | Password verification + signed session cookie                        | `src/features/auth/CLAUDE.md`        |
| groups      | Named sets of library rows, one namespace per surface                | `src/features/groups/CLAUDE.md`      |
| theme       | Six user-chosen colors, derived into the palette tokens.css declares | `src/features/theme/CLAUDE.md`       |
| user-images | User image uploads, library, and asset management                    | `src/features/user-images/CLAUDE.md` |
| visibility  | Hiding rows from a wall, and focusing on a few, without trashing     | `src/features/visibility/CLAUDE.md`  |
| video       | The video lineup: three models, their endpoints, and what each takes | `src/features/video/CLAUDE.md`       |

**Route-owned surfaces** — these had a `features/` folder until #181 and now
live with the one route that renders them:

| Surface    | Where                                                                                                                       |
| ---------- | --------------------------------------------------------------------------------------------------------------------------- |
| Canvas     | `app/(authenticated)/canvas/` — index; a board is `canvas/[id]/`. One CLAUDE.md at `canvas/` covers both                    |
| Explore    | `app/(authenticated)/explore/` (has its CLAUDE.md) — browsing, not working                                                  |
| Images     | `app/(authenticated)/images/` (has its CLAUDE.md)                                                                           |
| Lab        | `app/(authenticated)/lab/` (has its CLAUDE.md) — one step of the work per page, judged before it earns a place in the panel |
| Activity   | `app/(authenticated)/activity/` — the route; the log itself is a feature                                                    |
| Trash      | `app/(authenticated)/trash/` (has its CLAUDE.md)                                                                            |
| Video      | `app/(authenticated)/video/` (has its CLAUDE.md) — the route; the lineup is a feature                                       |
| App chrome | `app/(authenticated)/_components/` — shell, chrome, sidebar, mobile nav                                                     |
| Readme     | `app/(authenticated)/readme/` — renders README.md at /readme, nothing else                                                  |
| Account    | `app/(authenticated)/account/` — the settings area: its own nav and sub-pages                                               |

**Account is a section, not a page.** `account/layout.tsx` draws a nav beside
`Overview`, `Style` (the six colors that theme the app, `src/features/theme`)
and `Shortcuts`. Its pages are the ones _about_ genzen rather than places you
work, which is why only `/account` appears in the app's own rail — every path
under it lights that one item, and a second entry would light two rails at once.

`(authenticated)/_components/` also holds the generation UI Images and Canvas
share (`generator-panel/` and what it composes). Anything one route renders
lives with that route — #189 moved six folders out of there on that rule.

## Git workflow

Mechanics — branch, PR, squash-merge, issues as the durable record, no plan
files, the `git diff origin/main` vs. `git log origin/main..HEAD` distinction —
are [project-standard](https://github.com/joshcoolman/project-standard)'s call
("Git & issues"). This section holds only what genzen adds on top of that.

**The rule that does not relax: push the branch.** Never leave it local-only.
Three Macs pull from this remote, and work that exists on one machine's disk is
work the next machine cannot see — that is the actual failure behind the June
2026 tangle, where a branch was cut off a stale `main` and reproduced work that
already existed. Pushing fixes it; merging early is not required. This is also
why a branch may outlive a session — do not rush a merge to close the day.

**Merging without being asked is fine for straightforward work once the build
is green** — normal GitHub practice, not something to check in about every
time. It is never fine to assume a whole session should be committed straight
to `main` in bulk; that mode only applies when Josh says so at the start of a
session.

At the end of any session:

- Everything **finished** is merged to `main` and pushed
- Everything **in progress** is committed and pushed on its branch
- No work exists only on one machine's disk
- Branches for work that is genuinely done are deleted

Trivial exceptions that stay direct-to-`main`: a README `## Status` touch-up, or
a one-line fix to something already merged.

## Orientation and capture

Two durable surfaces, no continuation file: the README `## Status` block (last
shipped / up next) and open GitHub issues. Read both at session start.

**Issues are ranked by three labels — `focus`, `next`, `later`** — which the
upnext app renders as group headers, **oldest-touched first within a group**, and
an issue carrying none of them lands in Unsorted. Reordering is a label toggle,
not a priority number.

Two things this said wrongly until 2026-08-18, both of which cost a sort:

- **`now` is an upnext bucket that has no label in this repo**, and `focus` —
  which every ranked issue here actually uses — was not named at all. `gh` fails
  outright on a label it cannot resolve, so a `--remove-label` naming `now`
  removes nothing and reports success on the add, leaving an issue in two groups.
- **The direction is ascending, not most-recent-first.** A label edit touches
  `updatedAt`, so filing an issue _appends it to the bottom_ of its group and the
  **top of a group is the next thing to do**. Re-applying a label an issue already
  carries is a no-op and will not move it; forcing a position takes a remove and
  then an add. After changing any issue's
  labels, title or state, run `curl -s -X POST localhost:3210/api/nudge` so any
  open upnext tab repaints immediately — it answers `{"nudged":n}`, and `n` is how
  many tabs heard it, so `0` means nothing was listening rather than nothing
  happened. A push, not a poll, on purpose: polling re-spawns `gh` for every issue
  on a schedule forever, including on a tab left open all weekend.

**Write an issue so it makes sense cold.** The title says what is wrong or what
to build, in words you would say out loud -- never the name of a pattern. The
first line states the problem plainly, with no conclusion and no invented term
ahead of its definition. Reasoning and evidence still belong there, further
down. And an issue born from a conversation ends with **"Where this came from"**,
naming the date and quoting what was actually said -- an issue whose origin is
lost cannot be judged, only re-derived. If the origin is unknown, say so; a
plausible invented one is worse.

**Capture to GitHub issues, not the filesystem.** Anything worth carrying past
this session — a plan, a task, a bug, an idea from a poke-around session ("capture
this") — becomes an issue. Do not create plan files, handoff docs, an `ideas/`
folder, or a `continue/` directory; all of those existed and were removed
deliberately. Update the README `## Status` block at natural beats so the front
door always reflects the current state.

`docs/` is small on purpose: `OVERVIEW.md` (what genzen is), `SPEC.md` (what it
does and must do), `DELTAS.md` (the deltas from the house standard),
`deploying.md` (the deployment contract) and `reference/`. **Never a plan** — plans are issues, and a parked one rots. That is
genzen's only rule here; `reference/` otherwise follows the standard, which asks
for no particular name or structure. There is no in-app docs viewer — that route
and `src/lib/docs/` were deleted; `docs/` is plain repo files, not bundled
content.

## Project standard

[project-standard](https://github.com/joshcoolman/project-standard) is the house
standard — folder layout, component organization, styling, docs shape, naming.
Follow it as closely as this repo can.

**`docs/DELTAS.md` holds what genzen decides differently, and nothing else.**
Read that file rather than re-deriving them; it is the only place they live.
The two that come up constantly:

- **`features/` is headless and earned by 2+ consumers.** No `.tsx` under
  `src/features/`. One consumer means it belongs to that route.
- **`.server.ts` never imports from the client; `.action.ts` is a `'use server'`
  module that does.** Checked by `eslint-rules/server-suffix.js`.

Where the standard applies, prefer it over an older pattern found in the
codebase — an existing file is not evidence of the current convention, because
the conformance pass (#187) is still in flight.

**How a route is built:** the shape lives in the house standard
(`project-standard`, "Route shape") — `page.tsx` renders `view.tsx`, which
composes components and carries no styles; `use-view.ts` holds the state.
`docs/reference/route-shape.md` keeps only genzen's own evidence and its
primitives catalogue.

Copy `app/(authenticated)/trash/` for a simple route or `canvas/` for one with
real state; not Activity, which established the shape but still fetches from the
client. Every route conforms except `readme/` and `account/shortcuts/`, which are a
page and a stylesheet: they render fixed content and have no state, so
`view.tsx` and `use-view.ts` would both be empty indirection. Named here rather
than left as silent exceptions, because the value of "copy a neighbour" is that
it is safe.

## Gotchas

- Route protection is deny-by-default in `proxy.ts`; a new public path must be
  added to its `PUBLIC_PATHS`, or it redirects to /login
- There is no Tailwind and no CSS framework (#186). `src/styles/tokens.css` is the token layer, `src/styles/base.css` the reset, and every component has a `.module.css` beside it. `src/styles.css` imports those two and nothing else. Reach for `cx` from `#/lib/utils` to join module classes -- `cn`/`tailwind-merge` are gone. Two scripts guard it, both in `pnpm check` and CI: `check:colors` (no raw color outside tokens.css, #229) and `check:tokens` (no `var(--x)` that is declared nowhere, #407 -- an undeclared property does not error, it is dropped, so this breaks silently)
- **Every instruction sent to a model is a `.md` file in `src/lib/prompts/`**, imported as a string (#322). Assembly -- interleaving an image with text, branching on inputs -- stays in TypeScript beside its caller; only prose lives there. Two tests enforce it: nothing but `.md` in that folder, and no long model-addressed string in any `.ts`. The point is that changing what a model is told should be a text edit, not a code change
- **A family of prompts one feature switches between is a subfolder with an `index.ts` registry** -- `src/lib/prompts/describe/` is the pattern. The registry holds wiring only (id, label, the one-line user turn, a lazy `import()` of the `.md`) and everything else derives from it, so adding a prompt is a file drop plus one entry, not an edit in four places. `index.ts` is the one non-`.md` file a prompt folder may hold. Load the markdown with `() => import('./x.md')`, not a static import: client modules read these registries for their labels, and a static import puts every prompt's text in the browser bundle
- FAL generation uses on-demand polling via `src/lib/server/check-pending-generations.action.ts`. **There are no webhooks** -- the route, the flag and the env vars went in #362. Polling is the only path a result reaches the app, which is why nothing may switch it off
- **Pasting an image you already own uploads it again, as a new row.** The
  clipboard used to carry the record id instead (#213) so it did not; the only
  thing that put an id there was the Cmd-F overlay, and both went in #348. If
  copy-here-paste-there returns, put the id on the clipboard, not the bytes --
  see #347
- **A global overlay must take the keyboard, not share it**
  (`src/lib/keyboard-capture.ts`). Canvas replaces hotkeys-js's default
  text-field exemption with its own dialog check, so anything floating over a
  route sets the capture flag or Backspace in its input reaches the canvas
