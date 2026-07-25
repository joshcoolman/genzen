# Continue — joshcoolman

Personal resume pointer, keyed to GitHub login. Synced via git so any machine with
the latest pull gives the same session-start summary. **Keep this current:** replace
the "Where I left off" / "Next up" sections at the end of a work session and commit
(the `/handoff` skill writes here). This is a live pointer, not an append log — git
history holds the past. See `continue/README.md` for the convention.

## ⏯ Where I left off

**Session (2026-07-25) — direction changed: local-first, in place. #167 is DONE.**

Track B ("extract a new lean repo") is off. genzen migrates **in place** instead,
toward plain Postgres + generic S3 + Node on Next (#168). The README public-flip
is deliberately deferred — "worry about readme later".

**#167 local-first boot: implemented and verified.** `git clone && pnpm install
&& pnpm local:up && pnpm dev` now boots the whole app with **no cloud account
anywhere** and exactly one real key (`FAL_KEY`). Clean-slate boot measured at
**33 seconds**.

What landed:

- `src/lib/image-storage.ts` — the actual blocker. `R2ImageStorage` →
  `S3ImageStorage` taking an explicit endpoint + `forcePathStyle`; new
  `R2_ENDPOINT` with fallback to the derived Cloudflare endpoint, so **prod R2
  is untouched** (unit-tested). Dropped the vestigial `SupabaseClient` param
  from `createImageStorage()` and `downloadAndStoreImage()` (~30 call sites).
- `docker-compose.yml` — MinIO on **9010/9011** (not 9000/9001, so bootsy can
  run at the same time) + a one-shot `createbucket` that also does
  `mc anonymous set download` (genzen serves public URLs, not presigned).
- `scripts/local-up.mjs` + `local:up` / `local:down` / `local:reset`. Idempotent;
  upserts Supabase creds into `.env.local` without clobbering `FAL_KEY`; only
  resets the DB when the schema is absent (`--reset` forces).
- `.env.local.example` with working localhost values.
- pg_cron migration guarded; `seed.sql` duplicate `initial_grant` removed
  (ledger summed to 100 against a balance of 50) and its password comment fixed.
- Removed the dead `[storage.buckets.user-images]` from `supabase/config.toml` —
  it made `db reset` stop on an interactive Y/n prompt.
- Bonus, pre-existing bug: vitest was collecting compiled tests out of
  `.output/`, so `pnpm build && pnpm test` always failed. Excluded in
  `vitest.config.ts`.

Verified by driving the real app (agent-browser): login as the seed user →
`/dashboard/ai-images` → upload → **image renders from MinIO** (anonymous GET 200) → trash → restore → canvas. `pnpm test` 85/85, `pnpm build` green,
`pnpm check` 0 errors. Generation itself was NOT exercised — no `FAL_KEY` on
hand; that is the one gap.

**Visible failures (same session).** Clicking Generate used to be able to produce
nothing at all: the `user_images` row was written _after_ FAL accepted the job,
so any earlier failure left no card, no Activity entry, nothing to retry. Now the
row is **reserved before any fallible work**, and marked failed with a reason on
error. On the edit page a click now always yields cards (optimistic, up before
the request), each flipping to Failed with its reason, a Retry, an Activity
entry, and refunded credits. Plan: `docs/plans/visible-failures.md`.

Along the way: FAL's `ApiError` has an **empty `.message`** (detail lives on
`body.detail`) — `describeGenerationError()` digs it out; one failure used to
abort the whole batch; `replaceTempId` never updated `savedImages`; and the edit
page's `<ImageGallery>` never passed `onRetry`, so Retry could not render there.

**ROOT CAUSE of the dead generations: `~/.secrets.zsh:9` exports an invalid
`FAL_KEY`** (FAL: 401 "No user found for Key ID and Secret"). Being an exported
env var it **overrides `.env.local`** — so fixing the file alone does nothing.
`pnpm local:up` now warns loudly when a shell-exported key shadows the file.

**Setup noise removed.** `.env.local.example` is **deleted** — a template listing a
dozen vars read as "this needs configuring" when it doesn't. `scripts/local-up.mjs`
now owns `.env.local` outright (all MinIO + webhook constants live in the script)
and **prompts interactively for the FAL key**. `.env.example` is trimmed to
Required/Optional and is now purely a deploy reference. Setup is: `pnpm install`,
`pnpm local:up`, answer one question, `pnpm dev`.

**Generation confirmed working end to end** with a real key — #167 has no gaps
left. All 8 models generate. Two follow-ups landed:

- **Nano Banana 2 no longer goes direct to Google.** Its registry entry carried
  `provider: 'google'` (to reach Vertex at ~half FAL's price) despite already
  having a FAL model id, and it was the **only** model with that flag — the sole
  thing keeping the whole Google/Vertex path alive. Removed; it now completes via
  FAL. `isGoogleProvider()` is now false everywhere, so `google-imagen.server.ts`,
  `google-queue.server.ts`, `dispatch_google_queue` and the `useGoogle` branches
  are **dead code** — delete in #169. Bonus: canvas `canRetryFailure()` now allows
  retrying Nano Banana failures, previously dismiss-only.
- **Safety params were an either/or bug.** `fal-schema.server.ts` picked
  `safety_tolerance` *or* `enable_safety_checker`; FLUX.2 Pro exposes **both**, so
  the boolean checker stayed at its default `true`. Now detected and applied
  independently.

**Not a bug:** FLUX.2 Pro rejecting "cat in a hat" is Black Forest Labs' IP filter
(Dr. Seuss). Proved it — same model, same settings, "a tabby cat wearing a striped
top hat" completes. The failed card was telling the truth.

## ▶ Next up

- Replace the dead key in `~/.secrets.zsh` (it still shadows `.env.local` in every
  shell, though `.env.local` now holds a working one and `local:up` warns).
- Apply reserve-then-fail to the remaining paths: `generate-image-internal`
  (the main AI Images Generate button, has a Google branch), `generate-variation`,
  `submit-variations`. Until then the rule only holds on the edit + retry paths.
- Then **#168** in workstream order: `001_init.sql` + `migrate.mjs` + docker
  Postgres → auth (scrypt + signed cookie + middleware) → 67 server queries →
  53 browser queries → realtime→polling → Next port → delete Supabase.
  `~/repos/bootsy` is the reference implementation for every piece.
- README public-flip: deferred on purpose.

Parked (canvas Tier 2/3 structural — lower priority):

- Canvas renders via bespoke markup vs shared `Thumbnail`; duplicated completion-polling
  loops; `boundsOf`/`getBounds` duplication; `normalizeGeneration` has no unit tests.
