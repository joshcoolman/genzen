# Batch Processing for Discounted Generation

> **Status: research / not implemented.** This is a design exploration, not live
> architecture — nothing here is wired into the app. It also assumed the (now
> retired) monetization direction; treat as background reading, not a roadmap.

Research on using OpenAI + Anthropic batch APIs (and optionally Cloudflare Queues) to offer a cheaper "patient tier" of generation in genzen.

## TL;DR

- OpenAI and Anthropic both ship a **batch API that is 50% cheaper** than their synchronous equivalents, in exchange for async delivery (Anthropic typically < 1h, OpenAI up to 24h).
- OpenAI's batch endpoint also covers **`/v1/images/generations`, `/v1/images/edits`, and `/v1/videos`** — so "discounted rendering" is literally possible on OpenAI-hosted image/video models (e.g. `gpt-image-2`), not just text.
- FAL has **no batch API** today — savings there have to come from a different lever (cheaper models, prompt optimization, user-side caching). Batch discounts cannot be passed through for FAL-hosted generations.
- The reference Cloudflare Queue + D1 + Cron architecture from `jillesme/cloudflare-queue-batch-api` is a clean template, but genzen can replicate it using **only services already in use**: a Supabase `batch_jobs` table, Nitro h3 routes for submit/poll/fetch, **on-demand polling** (same pattern as `check-pending-generations.server.ts`) as the primary trigger, and **Vercel Cron** as a fallback tick for users who wander off. No new vendors, no Trigger.dev, no Cloudflare Queues.
- The right first move is a **"Frugal" tier** for workflows where latency-tolerance is natural (bulk prompt enhancement, multishot planning, eval runs, background variation sweeps), gated behind a clear "results in ~1h" UX.

---

## 1. The economics

| Provider  | Sync cost | Batch cost | Savings | Window                      | Notes                                                                                   |
| --------- | --------- | ---------- | ------- | --------------------------- | --------------------------------------------------------------------------------------- |
| Anthropic | 1×        | 0.5×       | 50%     | Usually < 1h, capped at 24h | Message Batches API. Full feature support (vision, tool use, system prompts).           |
| OpenAI    | 1×        | 0.5×       | 50%     | Up to 24h                   | Covers responses / chat / embeddings / completions / moderations / **images / videos**. |
| FAL       | —         | —          | —       | —                           | No batch mode.                                                                          |

**Per-batch limits:**

- Anthropic: up to ~100k requests / 256 MB per batch (per current docs).
- OpenAI: up to **50,000 requests / 200 MB** per batch file, max 2,000 batches/hour. Separate rate-limit pool from sync — doesn't eat your normal TPM.

**Cost back-of-envelope for genzen:**

- If 20% of our LLM spend is latency-tolerant (prompt enhancement, scene/multishot planning, evals), batching that slice drops it 50% → **~10% total LLM COGS reduction**. Modest.
- If OpenAI's batch tier becomes available for `gpt-image-2` in genzen's flow, the savings on image generation could be much larger given how image tokens dominate cost. **This is the more interesting lever.**

---

## 2. Where this applies in genzen

Mapping to the feature registry:

| Feature         | Batch candidate? | Why                                                                          |
| --------------- | ---------------- | ---------------------------------------------------------------------------- |
| `ad`            | No               | Interactive chat — latency is the product.                                   |
| `prompt-studio` | **Yes**          | Bulk prompt enhancement across a set is naturally async.                     |
| `multi-shot`    | **Yes**          | Planning N shots from a concept is a "go make coffee" workflow.              |
| `scenes`        | **Yes**          | Composition planning / caption generation across a scene library.            |
| `ai-images`     | Partial          | Single-shot is sync. A **"bulk variations" mode** (50 seeds overnight) fits. |
| `ai-video`      | Partial          | Same as above — multishot renders over a library.                            |
| `multi-model`   | **Yes**          | Parallel generation across N models already accepts longer waits.            |
| `notes`         | Partial          | Batch "summarize all notes" / "tag all notes" jobs.                          |
| `canvas`        | No               | Interactive edit.                                                            |
| `outpaint`      | No               | User is watching the canvas.                                                 |
| `history`       | n/a              | Read-only surface.                                                           |

The pattern: any place the user initiates N > 1 work and walks away is a candidate.

---

## 3. Reference architecture (from `jillesme/cloudflare-queue-batch-api`)

The linked repo is a clean three-stage pipeline:

```
POST /feedback
  → D1 row (status: queued)
  → Cloudflare Queue
  → Consumer Worker decides per-message:
      ├─ sync mode: call /v1/messages directly, update D1
      └─ batch mode: buffer into /v1/messages/batches, store batch_id
Cron Worker (every 1m in prod)
  → find in-progress batch_ids
  → fetch results
  → atomic D1 update (status: completed)
```

Key config in `wrangler.jsonc`:

- `max_batch_size`: 3 in dev, ~10 in prod
- `max_batch_timeout`: 60s (how long consumer waits to fill a batch before flushing)
- `max_retries`: 3 + dead-letter queue
- `QUEUE_RETRY_DELAY_SECONDS`: 30

Two patterns worth borrowing regardless of vendor choice:

1. **Single entry point** — every request goes through the queue, even sync-tier requests. Retry semantics and observability stay consistent.
2. **`jsonrepair` on LLM output** — Anthropic sometimes wraps JSON in code fences or appends commentary. Brittle regex parsing bites you; `jsonrepair` handles it once.

---

## 4. Stack choice: use what's already working

Trigger.dev has been a recurring source of pain on this project and isn't worth re-introducing for a job this simple. Submit → poll → fetch-results are all short HTTP calls — the opposite of the long-running, retry-heavy workflows Trigger.dev is built for. Cloudflare Queues + D1 is a coherent architecture but introduces Wrangler, a new datastore, and Worker deploys for no payoff at current scale.

**Everything this needs already exists in the stack:**

- **Supabase** for durable job state (one new table, same trust boundary as generations).
- **Nitro h3 routes** in `server/api/` for submit / poll / fetch-results (same pattern as every other server route).
- **On-demand polling** — the primary trigger. `src/lib/server/check-pending-generations.server.ts` already demonstrates this pattern for FAL: when a user loads a page, we check their in-flight work and pull results. A batch user loading `/activity` or `/history` is a user who wants their batch results — ride along with the page load.
- **Vercel Cron** as a fallback tick (every 1–5 min) for the "user submitted and wandered off" case. Vercel Analytics is already in deps, so we're on Vercel — a cron line in `vercel.json` pointed at `/api/batch/poll-all` is the whole integration.

### Comparison

| Capability           | Cloudflare Queues         | Trigger.dev            | **Supabase + Vercel Cron (recommended)**  |
| -------------------- | ------------------------- | ---------------------- | ----------------------------------------- |
| Durable job state    | D1 (new)                  | Supabase (existing)    | Supabase (existing)                       |
| Producer             | Worker endpoint           | `task.trigger()`       | Nitro `/api/batch/submit`                 |
| Scheduled poll       | Cron Worker               | Scheduled task         | Vercel Cron → Nitro route                 |
| On-demand poll       | n/a                       | n/a                    | Page-load hook (free, already a pattern)  |
| Retries              | Native DLQ                | Built-in               | `attempts` column + on-failure reschedule |
| Observability        | Workers logs              | Trigger dashboard      | Same logs as the rest of the app          |
| New vendor           | CF Queues + D1 + Wrangler | Trigger.dev            | **None**                                  |
| Past-experience risk | Unknown                   | High (prior headaches) | Low (mirrors existing patterns)           |

### When to revisit

Flip to Trigger.dev or Cloudflare only if a concrete pain shows up: fan-out with complex dependencies, multi-hour multi-step workflows that must survive redeploys, or a team-wide observability need that Postgres rows can't satisfy. Batch submit/poll doesn't qualify.

---

## 5. Product UX: selling "discounted rendering"

A few design axes to pick from. None are exclusive.

**A. Tier switch at the generation site** — a "Patient / Frugal" toggle next to the model picker. 50% off, results appear in history when ready. Low friction, highest discoverability.

**B. Explicit "Batch Mode" surface** — a new route (`/batch`) where the user composes N jobs and submits them together. Higher commitment, better fit for power users running evals or variation sweeps.

**C. Background auto-batching for specific flows** — e.g. "Enhance all prompts in this set" in prompt-studio is _always_ routed through batch, never sync. No user-visible toggle, just shows a progress indicator. Simpler, but the savings are invisible — we'd either pocket them or pass them through as lower credit cost.

**D. Scheduled runs** — "run this overnight" for very large jobs. Aligns naturally with the 24h window on OpenAI. Best fit for the multi-model feature.

The **activity** feature already logs cost/time for every generation, including failures — that's the right surface to show realized savings ("You saved $3.20 this week on batch renders").

### Credit / pricing implication

If we charge in credits, we have options:

1. **Pass the discount through** — frugal tier costs the user 50% credits. Clean, honest, probably lower conversion impact than you'd expect because the user self-selects on patience.
2. **Pocket the margin** — same credit cost either way, we improve unit economics. Less compelling to users, easier to undo later.
3. **Split it** — 25% off to the user, 25% to us. Probably the right first cut.

This ties directly into the Gate 2 pricing work (`project_critical_path.md`) — worth making the frugal tier a pricing lever from day one rather than retrofitting later.

---

## 6. Technical sharp edges

- **Order is not preserved.** OpenAI returns results by `custom_id`, not input order. Any UI that assumes "row 1 response → row 1 card" must key on `custom_id`.
- **Partial failures.** A batch can complete with 5 of 50 requests failing. The error file is separate — don't treat the output file as authoritative.
- **Output files expire.** OpenAI auto-deletes batch outputs after 30 days. Persist the fetched results to Supabase immediately.
- **ZDR.** Anthropic explicitly notes the Message Batches API is **not eligible for Zero Data Retention**. If we ever sell to customers with strict data-retention contracts, they can't use this tier. Worth a line in terms of service.
- **Polling cost.** Even at 60s cadence across hundreds of in-flight batches, polling is cheap. But `mget` on a single batch ID vs. listing all your batches matters — always fetch by ID once you have one.
- **Prompt caching interaction.** Batch requests don't benefit from prompt caching the way sync does. If we use a big cached system prompt in the AD path, moving that traffic to batch could _erase_ cache savings. Measure before migrating any given flow.
- **Image generation via OpenAI Batch.** Docs list the endpoint as supported, but real-world latency for image batches is less documented than text. If we bet on this for `gpt-image-2`, we should pilot it with a small cohort first.
- **Idempotency.** If the user cancels or retries while a batch is in flight, we need `request_id` → `batch_id` mapping to avoid double-charging.

---

## 7. Proposed rollout (phased)

**Phase 1 — Infrastructure (1–2 days).** Supabase table `batch_jobs` (id, user_id, provider, batch_id, status, request_payload, response_payload, submitted_at, completed_at, cost_estimate, cost_actual, attempts). Shared server helpers `submitBatch()` / `pollBatch()` / `fetchBatchResults()` in `src/lib/server/batch/`, modeled on `check-pending-generations.server.ts`. Three Nitro routes: `POST /api/batch/submit`, `POST /api/batch/poll` (single job by id — used by on-demand triggers), `POST /api/batch/poll-all` (every in-flight job across users — called by Vercel Cron every 1–5 min). On-demand hook fires from the activity and history page loaders for any in-flight batches owned by the current user.

**Phase 2 — First consumer: prompt-studio bulk enhance (1 day).** Lowest-risk surface. Add "Enhance all (frugal)" action. No user-facing credit change yet — validate correctness, latency, and polling economics.

**Phase 3 — Activity surface (0.5 day).** Extend activity feature to show batch lifecycle (queued → submitted → completed) with realized savings.

**Phase 4 — Pricing lever (tied to Gate 2).** Expose frugal tier in the UI with credit discount. A/B whether it cannibalizes sync tier or expands total usage.

**Phase 5 — Expand to multi-model / multi-shot / ai-images bulk variations.** Once the primitive is proven.

**Phase 6 (optional).** Pilot OpenAI image batch for `gpt-image-2` — the biggest single lever if it pans out.

---

## 8. Open questions

1. Do we want per-user batch queues (fairness, per-user latency) or a single global batcher (maximum coalescing, best for cost)?
2. If Anthropic batch doesn't honor prompt caching, does the AD-related tooling lose more than it gains by moving to batch? (Needs measurement.)
3. For the image batch path, do we need to deal with content-moderation holds in OpenAI's pipeline differently than the sync path?
4. Does offering a frugal tier fragment the narrative around genzen's product ("fast, magical") or enrich it ("power users can go deep cheaply")?
5. Should we batch at the Supabase layer (rows → poll) or at an in-memory coalescer (accumulate N requests for T seconds, then submit)? The reference repo does both — rows are durable, the queue timer coalesces.

---

## References

- [`jillesme/cloudflare-queue-batch-api`](https://github.com/jillesme/cloudflare-queue-batch-api) — reference architecture
- [Cloudflare Queues docs](https://developers.cloudflare.com/queues/)
- [Cloudflare Workers docs](https://developers.cloudflare.com/workers/)
- [Anthropic Message Batches](https://platform.claude.com/docs/en/build-with-claude/batch-processing)
- [OpenAI Batch API](https://developers.openai.com/api/docs/guides/batch)
