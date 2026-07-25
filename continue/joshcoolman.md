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
7. ✅ Pare the README to "how to run this locally"

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

**Step 7 done.** README is "what it is, how to run it, the map" — the SaaS pitch,
the credits/Stripe highlights, and the "abandoned SaaS, have at it" framing are
gone. `docs/development-workflow.md` lost its revenue milestones.
`docs/research/` is untouched on purpose: it's a record of what was considered,
not a plan.

**#169 is complete and verified against the real app, not just the build.**
Running the migrations caught two things `pnpm build` never could:

1. `DROP COLUMN account_status` failed — the "Users can update own profile" RLS
   policy's `WITH CHECK` referenced it (its whole job was stopping a user
   promoting themselves off the waitlist). CASCADE would have silently deleted
   the policy, so the migration now drops and recreates it with
   `WITH CHECK (auth.uid() = id)` first.
2. `seed.sql` still had the `account_status = 'active'` UPDATE, which broke
   `supabase db reset` at the seed step.

After fixing both, a \*\*clean-slate `supabase db reset` applies all 48 migrations

- seed green\*\*, and the schema is verifiably clean: no `credit_transactions`, no
  `credit_balance`, no `account_status` (or its enum), none of
  `add_credits`/`deduct_credits`/`get_credit_balance`/`check_rate_limit`/
  `dispatch_google_queue`/`reset_stale_google_processing`, and
  `user_images_status_check` narrowed to `pending | completed | failed`.

Then drove the built app (agent-browser, prod server on :3009):

- `/docs` opens with **no password prompt**
- login → `/dashboard/ai-images`, no waitlist redirect, no credit balance in the header
- **real generation with a live key**: row reserved → submitted → completed,
  `estimated_cost_cents: 5` written at submit and `provider_cost_cents: 5` +
  `provider_cost_is_estimate: true` at completion
- Activity shows one **COST** column reading `~$0.05` (the `~` is the estimate
  marker), status filters down to Completed/Failed/Pending
- **reserve-then-fail proven**: restarted with a bad FAL key, clicked Generate →
  row `failed` with `invalid key credentials — HTTP 401`, no `request_id`, and a
  visible "Failed / See Details" card in the gallery plus an Activity row. That
  exact case used to leave nothing at all.

## ▶ Next up

- **Rescope #168** before starting it. It still says to keep `deduct_credits` /
  `add_credits` verbatim as "real business logic" and lists `credit_transactions`
  among the live tables. After #169: two fewer tables, several fewer functions,
  a smaller Workstream 1. Comment already left on the issue.
- Replace the dead key in `~/.secrets.zsh` (still shadows `.env.local` in every
  shell; `local:up` warns).
- Note: two dev servers in this repo fight over `routeTree.gen.ts` and cause a
  reload loop. If the app is stuck on "Loading...", that's why — use a prod
  preview (`node .output/server/index.mjs`) or stop the other one.

Parked (canvas Tier 2/3 structural — lower priority):

- Canvas renders via bespoke markup vs shared `Thumbnail`; duplicated completion-polling
  loops; `boundsOf`/`getBounds` duplication; `normalizeGeneration` has no unit tests.
