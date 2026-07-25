# Continue — joshcoolman

Personal resume pointer, keyed to GitHub login. Synced via git so any machine with
the latest pull gives the same session-start summary. **Keep this current:** replace
the "Where I left off" / "Next up" sections at the end of a work session and commit
(the `/handoff` skill writes here). This is a live pointer, not an append log — git
history holds the past. See `continue/README.md` for the convention.

## ⏯ Where I left off

**Session (2026-07-25c) — missing-key feedback, and a typecheck gap.**

"Enhance prompt not working" had **two** causes, not one:

1. **No `ANTHROPIC_API_KEY`.** `ai.reasoning` is Anthropic Sonnet, so the AI SDK
   threw deep inside `generateText`.
2. **The error was invisible.** `use-generator` called `setError(message)` — and
   the AI Images page never rendered `error` anywhere. The click did nothing at
   all, silently. (Generate-submit failures were equally invisible; only the
   reserved failed _card_ made those visible.)

Fixes:

- `src/lib/ai-keys.ts` — a portable marker/parse pair so "this failed for want
  of a key" survives the server-fn boundary, which only carries a string.
- `requireAiKey` / `requireAiRole` in `ai.server.ts`, applied to all six model
  call sites. Guarded inside `describeImage` rather than at its callers, because
  `caption-image` should surface the failure while `generate-image-internal`
  already catches and falls back to a placeholder prompt — one guard, both
  behaviours correct.
- `MissingKeyDialog` + `MissingKeyProvider` (mounted in `dashboard.tsx`) and
  `useReportError()`: hand it any caught error — missing key opens the dialog,
  anything else toasts, nothing is swallowed. The dialog notes the AD panel's
  key is browser-only and deliberately never sent to the server (`ADSetup`
  promises exactly that, so wiring it server-side would break a stated promise —
  worth revisiting only as an explicit decision).

**The edit page never had Enhance at all.** Its hand-built `GeneratorState`
adapter omitted `handleEnhancePrompt`, and `PromptList` only renders the button
when a handler is passed — so it silently didn't exist there. Now wired.

**Nothing was typechecking.** `pnpm build` is Vite (no typecheck) and `pnpm check`
is prettier+eslint, so **16 TS errors** had accumulated, including the edit-page
adapter above. Added **`pnpm typecheck`** (`tsc --noEmit`) and fixed all of them.
Run it before commits alongside check/test/build.

**`pnpm local:up` now asks for Anthropic after FAL**, and only prompts for keys
that are still missing — so a re-run tops up rather than re-asking. The Anthropic
entry is flagged "strongly recommended" with what it unlocks. Added a **Supabase
CLI preflight**: it's a global tool, not an npm dependency, so a fresh machine
previously failed with the unhelpful `Failed: supabase start`.

**`local:up` now hands back a running app.** It finishes by checking whether
anything is already serving :3000 — if so it just opens the browser there, and
if not it starts `pnpm dev --open` in the foreground (Ctrl-C stops it; a signal
exit is reported as 0, not a failure). `--no-dev` skips that. The port probe
checks **both** 127.0.0.1 and ::1: Vite binds `localhost`, which resolves to ::1
first on macOS, so an IPv4-only probe misses a running server and starts a
second one. Verified against a stub bound to `[::1]:3000`.

**No marketing homepage.** `/` now redirects — signed in → `/dashboard`, else →
`/login`. Done in the component, not `beforeLoad`: auth lives in localStorage, and
a route's `beforeLoad` does not re-run after the server already matched it, so a
direct hit on `/` sat there forever. Deleted the orphaned `GlobalNav`,
`ModelShowcase` and `FeaturedModels`.

Verified in the built app: dialog appears with the key absent; with the key added
mid-session, Enhance expanded a prompt for real; `/` redirects both ways.

## ▶ Next up

**#168 (leave Supabase → Postgres + S3 + Node, on Next) is the next push, and it
is rescoped and ready to start.** #167 is closed.

Read the issue — it was rewritten against `main` post-#169 with measured numbers,
so trust it over anything remembered. The three things that changed:

1. **Workstream 1 has no business logic left.** Every function it said to keep
   verbatim is deleted; `.rpc()` sites went 6 → 0. Schema is now ~4 tables, no
   enums, one trigger function.
2. **`user_profiles` has zero query sites** — trigger-written, read by nothing.
   Put `display_name` on `users` and drop it. The old `FOR UPDATE` lock-contention
   warning is moot.
3. **Workstream 3 is untouched and is the bulk**: 111 `.from()` sites, 57 of them
   browser-side including 6 hard `DELETE`s guarded only by RLS.

Suggested start: **schema + auth together** (schema alone is no longer enough work
to stand alone, and auth needs the `users` table anyway). `~/repos/bootsy` is the
reference implementation for every piece.

Also worth knowing before starting:

- **There is no create-user script.** The only user is the one `supabase/seed.sql`
  inserts (`testuser@gmail.com`). Provisioning arrives with Workstream 2, via
  bootsy's `scripts/create-user.mjs` + `hash-lib.mjs`.
- **#168 removes the Supabase CLI prerequisite.** It's a global tool, not an npm
  dependency; plain Postgres in the existing docker-compose needs no CLI.
- Run **`pnpm typecheck`** alongside check/test/build. Nothing typechecked before
  this session and 16 errors had accumulated; `pnpm build` is Vite and won't catch
  them.
- Replace the dead key in `~/.secrets.zsh` (still shadows `.env.local`; `local:up`
  warns about it).
- Two dev servers in this repo fight over `routeTree.gen.ts` and cause a reload
  loop that looks like a hang on "Loading...". Use a prod preview
  (`node .output/server/index.mjs`) or stop the other one.

Parked (canvas Tier 2/3 structural — lower priority):

- Canvas renders via bespoke markup vs shared `Thumbnail`; duplicated completion-polling
  loops; `boundsOf`/`getBounds` duplication; `normalizeGeneration` has no unit tests.
