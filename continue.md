# Continue: Phase 3 — Detailed FAL failure messages (ai-video)

## Where we are

- Branch: `feature/optimistic-generation` (pushed, tracks origin)
- Tracking issue: **#126** — "Instantaneous generation UX + accurate FAL failure messaging"
- Full plan: `~/.claude/plans/fancy-sauteeing-meteor.md`
- Phase 1 **done** (commit `c028f5c`): generic `useOptimisticGeneration` primitive + `buildPendingVideo` helper.
- Phase 2 **done** (latest commit on branch): fire-and-forget generate path. Click → pending card same frame → rapid-fire works → failures flip to `failed` in place. Verified with `pnpm check && pnpm build`.

## Phase 2 recap — what changed, so Phase 3 knows the shape

- `generate-video.server.ts` accepts an optional client-minted `id` (UUID validated) and uses it as `user_images.id` on both FLF and multishot inserts. Non-optimistic callers still work.
- `use-videos.ts` dropped the `startsWith('optimistic-')` swap branch — the existing `prev.some((v) => v.id === newVideo.id)` dedupe at realtime INSERT time is enough now that client and server share the id. Added `markOptimisticFailed(id, error)` that flips a row's `status` to `'failed'` and stamps `generation_error`.
- `use-video-sidebar.ts` `generate()` is now **synchronous**. Validates, mints an id via `useOptimisticGeneration`, fires the server call as `void`, returns the id. `generating` state is gone. `onOptimistic(id, state)` and `onError(id, err)` are required options.
- `VideoGeneratorPanel.tsx` no longer gates the button or form inputs on `generating`. Rapid-fire is unblocked.
- `video.index.tsx` + `video.edit.$videoId.tsx` wire `onOptimistic: (id, state) => gallery.addOptimisticCard(buildPendingVideo(id, state, sessionParentId))` and `onError: (id, err) => gallery.markOptimisticFailed(id, err)`. Edit route also sets `highlightedId = id` on the pending card so it's immediately selected.

## Problem Phase 3 solves

When FAL rejects a gen, the real message (e.g. "Output audio has sensitive content", "Invalid aspect ratio for model X") is currently lost. Failed cards say `FAL job FAILED` because `check-pending-generations.server.ts:82–102` collapses status to a generic string, and `generate-video.server.ts` has no try/catch around the `fal.queue.submit` call — a submit-time rejection just throws through `withCreditRefund` and the user sees a toast but no persisted card.

`markOptimisticFailed` (from Phase 2) already surfaces whatever `error.message` the submit threw on the client. Phase 3's job is to make that message *accurate* and to persist the same information on the row itself so the poll path and webhook path (which don't go through the client-side error handler) surface it too.

## Phase 3 scope

Work in this order:

### 1. `src/lib/server/fal-error.server.ts` — new file

Export `extractFalError(err: unknown)` → structured blob. The FAL SDK throws errors whose `body.detail` is an array of `{ loc, msg, type }` objects; walk it and join the `msg`s. Fallback chain: `body.detail[].msg` → `body.message` → `err.message` → `'FAL request failed'`.

Return shape:

```ts
export interface FalErrorBlob {
  status: 'failed'
  code: string          // e.g. 'fal_submit', 'fal_queue', 'fal_webhook', 'unknown'
  message: string       // human-readable
  fal_request_id?: string
  failed_at: string     // ISO
  stage: 'submit' | 'queue' | 'webhook'
}
```

Pure function, no logging — callers log. Unit-test against representative fixtures.

### 2. Widen `VideoGenerationMetadata.error`

`src/features/ai-video/video-types.ts:54` currently has `error?: string`. Change to `error?: FalErrorBlob`. Keep the `generation_error` column as a `string` mirror of `error.message` — no Supabase schema change needed (`generation_metadata` is `jsonb`).

Grep for reads of `generation_metadata.error` before flipping the type. Current check: only written, never read — VideoCard reads `generation_error`. Safe.

### 3. Wire `extractFalError` into `generate-video.server.ts`

Both `generateFlf` and `generateMultishot` do `const { request_id } = await fal.queue.submit(...)` with no try/catch. Wrap it:

```ts
let request_id: string
try {
  const result = await fal.queue.submit(videoModel, { ... })
  request_id = result.request_id
} catch (err) {
  const blob = extractFalError(err)
  blob.stage = 'submit'
  // Insert a failed row using the client id so the optimistic card collapses
  // into it via realtime. Rethrow so withCreditRefund refunds the credit.
  await supabase.from('user_images').insert({
    ...(data.id ? { id: data.id } : {}),
    user_id: userId,
    status: 'failed',
    source: 'ai_video',
    title: getVideoModelName(videoModel),
    generation_error: blob.message,
    generation_metadata: {
      method: 'flf',  // or 'multishot' in the other branch
      parent_id: data.parentId ?? null,
      model: videoModel,
      submitted_at: new Date().toISOString(),
      error: blob,
    },
  })
  throw new Error(blob.message)
}
```

The rethrow is important — `withCreditRefund` depends on the throw to refund. The client's `onError` handler will also fire `markOptimisticFailed`; that's harmless double-marking because the realtime INSERT/UPDATE will overwrite with the server's blob.

### 4. `src/lib/server/check-pending-generations.server.ts`

Around line 82–102 there's a block that builds a lossy `` `FAL job ${statusStr}` `` string when a queued gen returns non-completed status. Replace with `extractFalError` on whatever the queue result exposes. Check `@fal-ai/client` types to see what's actually available — don't guess. Preferentially walk `response.logs[].message` or `response.error.detail`; last-resort fallback synthesizes `{ stage: 'queue', message: 'FAL queue reported error' }`.

Then update the row:

```ts
await supabase.from('user_images').update({
  status: 'failed',
  generation_error: blob.message,
  generation_metadata: { ...existing, error: blob },
}).eq('id', video.id)
```

### 5. Webhook route

FAL webhook handler lives in `server/api/` (check `project_fal_webhooks` memory for the exact path). On a non-OK webhook payload, extract the blob with `stage: 'webhook'` and persist the same way as step 4.

## Exit criteria

1. `pnpm check && pnpm build` clean.
2. Force a real FAL failure (e.g. `generate_audio` + a prompt that trips the safety filter, or an invalid aspect ratio). Card shows the real FAL message, not "FAL job FAILED".
3. Force a submit-time failure (easiest: temporarily break `FAL_KEY` in `.env.local`). Optimistic card flips to `failed` with the real message and credit is refunded.
4. Commit: `feat(video): Phase 3 — structured FAL error capture end-to-end` (reference #126).
5. Push, then close #126.

## Git state

- Clean working tree on `feature/optimistic-generation` at the Phase 2 commit.
- `main` untouched — all work on the feature branch per solo-dev workflow memory.

## Notes / gotchas

- Phase 2's `markOptimisticFailed` only sets `generation_error`, not `generation_metadata.error`. Once the type is widened, leave that client path as-is — let the server be the source of truth for the structured blob; the realtime INSERT/UPDATE overwrites the client-side placeholder fast enough.
- Don't skip the webhook path — it's what fires in production when webhooks are enabled. The poll path is the dev/fallback.
- A Phase 4 "expand details on failed card" UI could read `generation_metadata.error` and show stage/code/request_id. Out of scope here but worth noting.
