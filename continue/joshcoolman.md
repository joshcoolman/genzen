# Continue — joshcoolman

Personal resume pointer, keyed to GitHub login. Synced via git so any machine with
the latest pull gives the same session-start summary. **Keep this current:** replace
the "Where I left off" / "Next up" sections at the end of a work session and commit
(the `/handoff` skill writes here). This is a live pointer, not an append log — git
history holds the past. See `continue/README.md` for the convention.

## ⏯ Where I left off

**Session (2026-07-25b) — executing #169 "No Stripe, no credits".** Decisions
confirmed up front: no Stripe, no credits, FAL is the only image provider, and
both "undecided" items get the same answer as credits — **`account_status`/waitlist
and `check_rate_limit` are both being removed.**

Order of work (each its own commit, `pnpm check && pnpm test && pnpm build` first):

1. ✅ Delete the dead Google/Vertex stack
2. ✅ Stripe removal
3. ✅ Credits removal
4. ✅ Finish reserve-then-fail on the last 3 generate paths
5. ✅ Activity: make the FAL cost actually get written on all 5 paths
   (the column collapse itself landed early, forced by step 3)
6. ✅ Drop `DOCS_PASSWORD` + 4 dead env vars
7. ⬜ Pare the README to "how to run this locally"

**Step 1 done.** The Google/Vertex path went unreachable in 3c085f0 when
`provider: 'google'` came off Nano Banana 2 (its only carrier). Deleted
`google-imagen.server.ts`, `google-queue.server.ts` (+test), every `useGoogle`
branch in `media.server.ts` / `generate-image-internal` / `generate-variation` /
`submit-variations`, `isGoogleProvider`/`isGoogleModel`, the `providerOverride`
option, the `provider`/`ModelProvider` field on the model registry, and the
`@google/genai` dependency. `canRetryFailure()` on canvas is now just "has a
recordId". Forward migration `20260725000000_drop_google_queue.sql` drops
`dispatch_google_queue` + `reset_stale_google_processing` and narrows the
`user_images` status constraint to `pending | completed | failed` (the
Google-only `queued`/`processing` rows are failed on the way through, since
nothing can ever dispatch them again). Vision is untouched — Describe/Caption run
on `@ai-sdk/google` + `GOOGLE_GENERATIVE_AI_API_KEY`, which was never the Vertex
credential.

**Step 2 done — Stripe is gone.** `stripe.server.ts`,
`create-checkout-session.server.ts`, `CreditPackSelector.tsx`, the
`/api/stripe-webhook` route (+test), `CREDIT_PACKS`, the checkout
success/cancel banner on the account page, and the `stripe` dependency. Forward
migration `20260725000001_drop_stripe.sql` drops `user_profiles.stripe_customer_id`
and `credit_transactions.stripe_event_id`, and recreates `add_credits` without
`p_stripe_event_id` — that parameter was purely the webhook's idempotency
guard, so with no webhook there's nothing left to deduplicate. Credits still
exist at this point; step 3 takes them.

**Step 3 done — credits are gone.** The whole `src/features/credits/` tree (17
files), the 5 server guards (`checkAndDeductCredits` / `withCreditRefund` on
generate / edit / variation / submit-variations / retry), every client consumer
(`use-generator`, `use-variations`, `use-edit-page`, `use-ai-images-page`,
`use-canvas-generate`, `GeneratorPanel`, the dashboard header balance, the AD
context line, the account page's Credits section), the MCP `get_credit_balance`
tool plus the credit fields on `generate_image` / `edit_image`, and the
credits language in Terms + Privacy. Migration
`20260725000002_drop_credits.sql` drops `credit_transactions`,
`user_profiles.credit_balance`, `deduct_credits` / `add_credits` /
`get_credit_balance`, and takes the 50-credit grant out of `handle_new_user()`.

**Activity's column collapse came along for the ride.** "YOU PAID" was
`generation_type × CREDIT_COSTS × DOLLARS_PER_CREDIT` — pure credits math, so it
could not outlive them. Activity now shows a single **Cost** column reading
`provider_cost_cents`.

**What that trace turned up (matters for step 5).** `provider_cost_cents` is
written in exactly one place, `processImageResult` at completion, as
`falCostCents ?? estimatedCostCents`. `extractFalCostCents` probes FAL's result
payload for a cost field and — per its own comment — has never been verified
against a real response, so in practice it returns null and the value falls back
to `estimated_cost_cents`. And `estimated_cost_cents` is written by **only**
`generate-image-internal`. Net: edits, variations, submit-variations and retries
record **no cost at all** and show `—`. Activity is now the only spend guard, so
step 5's real job is writing `computeFalCostCents` at submit on the other four
paths.

**Step 3b — waitlist + rate limit, the two "undecided" items.** Both removed, as
confirmed. `account_status` gated signups for an app with no signups; its only
observable effect was `seed.sql` having to override a `waitlist` default to make
my own user usable. Gone with it: `src/lib/account-status.tsx`, the
`/dashboard/pending` route, the `activeOnly` nav flag, and the `beforeLoad`
guards on ai-images + settings. `check_rate_limit` (20 image requests/60s) only
ever protected me from myself — `rate-limit.server.ts` (+test) and its three
call sites are gone. Migration
`20260725000003_drop_waitlist_and_rate_limit.sql` drops the function, the
`rate_window_*` columns, `account_status`, and the enum type.

**Step 4 done — reserve-then-fail now holds on all five generate paths.**
`generate-image-internal`, `generate-variation` and `submit-variations` joined
edit and retry. The rule: **clicking Generate always leaves something on the
board.**

Two things made these harder than the edit path:

- `generate-image-internal` wrote its row with an inline insert _after_ FAL
  accepted the job, and several facts in that insert are only knowable after the
  fallible work (the resolved `imageInputModelId`, a prompt derived from the
  source image via Haiku, the cost estimate). So it needed reserve-then-**update**:
  `markGenerationSubmitted` now takes an optional `metadataPatch` that merges
  into `generation_metadata` alongside `request_id`.
- In `generate-variation` the prompt is itself the output of a **Claude call**
  inside the loop. That's fallible, so the reservation has to happen before it,
  seeded with `rootPrompt` and patched with the varied prompt at submit.

Both variation paths also stopped letting one failure kill the batch: each
iteration catches, marks its own row failed, and pushes `{ recordId }` with no
`request_id`, so the client still gets a card per prompt.

`createPendingGeneration` gained `onCanvas`, `sortOrder`, and an optional
`generationType` (plain text-to-image has never carried one).

**Step 5 done — Activity is now a real spend guard.** The trace in step 3 found
that only `generate-image-internal` ever wrote `estimated_cost_cents`, and that
`extractFalCostCents` has never actually matched a live FAL image-queue
response. So four of five paths recorded no cost at all and Activity showed `—`.
All five now call `computeFalCostCents` at submit (edit passes
`quantity: numImagesToGenerate`).

**And it no longer presents an estimate as a measurement.**
`provider_cost_cents` is `falCostCents ?? estimatedCostCents`, and in practice
it's always the estimate. `processImageResult` now also writes
`provider_cost_is_estimate`, and the row, detail panel, preview and totals
prefix estimated figures with `~` (the detail panel spells out "estimated").

Also swept out the now-impossible `queued` / `processing` statuses left over
from the Google queue: the `GenerationStatus` union, the Activity status filter
pills, the status badges, `normalize-generation`'s `VALID_STATUSES`, and the
polling predicates in `use-images` / `use-activity-page`. Narrowing the union
made ESLint flag the dead branches for me. `deriveProvider` lost its
Google/OpenAI cases — FAL is the only thing that can appear.

**Step 6 done.** `/docs` is open — `verifyDocsPassword`, the password form, the
`docs-password` localStorage round-trip and `DOCS_PASSWORD` are gone (the gate
already failed open when unset, so it protected nothing anyone couldn't get past
by not setting it). Dropped `OPENAI_API_KEY` and `GOOGLE_APPLICATION_CREDENTIALS`
(zero references), and `OPENROUTER_API_KEY` + `XAI_API_KEY` along with
`fastTextModels`, which had no consumer in `src/`. That left `@ai-sdk/xai` and
`@ai-sdk/openai-compatible` unimported, so they went too. `ai.server.ts` is now
three models and three roles.

Required env is down to **`FAL_KEY`** plus Supabase/S3 wiring, with
`ANTHROPIC_API_KEY` and `GOOGLE_GENERATIVE_AI_API_KEY` optional.

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
left. Removed FLUX.2 Pro from the registry entirely (Josh doesn't want it). Two follow-ups landed:

- **Nano Banana 2 no longer goes direct to Google.** Its registry entry carried
  `provider: 'google'` (to reach Vertex at ~half FAL's price) despite already
  having a FAL model id, and it was the **only** model with that flag — the sole
  thing keeping the whole Google/Vertex path alive. Removed; it now completes via
  FAL. `isGoogleProvider()` is now false everywhere, so `google-imagen.server.ts`,
  `google-queue.server.ts`, `dispatch_google_queue` and the `useGoogle` branches
  are **dead code** — delete in #169. Bonus: canvas `canRetryFailure()` now allows
  retrying Nano Banana failures, previously dismiss-only.
- **Safety params were an either/or bug.** `fal-schema.server.ts` picked
  `safety_tolerance` _or_ `enable_safety_checker`; FLUX.2 Pro exposes **both**, so
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
