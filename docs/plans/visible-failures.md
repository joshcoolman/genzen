# Visible failures: clicking Generate always puts something on the board

## The rule

Clicking Generate must **always** produce a visible artifact — a card, a status, a
reason, and a way to try again. A missing API key is not a special case; it is
just one failure among many (FAL down, bad input, source image gone, storage
unreachable, invalid model). None of them may vanish silently.

## Why it's broken today

All four generate paths share one shape:

```
FAL_KEY guard  ->  credits  ->  withCreditRefund(  ...fallible work...
                                                    fal.queue.submit()
                                                    createPendingGeneration()  <- row created LAST
                                                 )
```

The `user_images` row is written **after** FAL accepts the job. So anything that
throws before that point leaves no row — and with no row there is no placeholder
card, no Activity entry, and nothing to retry. The client's `catch` does call
`setError(...)`, but on the edit page that state is only rendered inside the
`if (!page.sourceImageMeta)` early return (`edit.$imageId.tsx:345`), which is
unreachable once the image has loaded. Hence: brief spinner, then silence.

Confirmed empirically: after a failed "Generate 3 edits", `user_images` contained
only the 6 uploads — no pending row, no failed row.

## Why the fix is small

The failure _experience_ is already built and wired:

- `FailedImageCard` (with `onRetry`) is already rendered by `ImageGallery` for
  `status === 'failed'`
- `retryGeneration` reconstructs the job from `generation_metadata`
  (`prompt` + `fal_model_id`) on any `failed` row
- Activity already reads failed rows (`list-activity.server.ts`)
- `user_images.request_id` is **nullable**, so a row can legally exist before FAL
  is ever contacted

Nothing new needs designing. The row just has to be created earlier.

## The change

Invert the order: **reserve the row first, then do the fallible work.**

```
credits  ->  withCreditRefund(  reserveGeneration()        <- row exists from here on
                                try { ...fallible work...
                                      fal.queue.submit()
                                      markGenerationSubmitted(requestId) }
                                catch { markGenerationFailed(reason); rethrow } )
```

Rethrowing preserves the existing credit refund and still surfaces the error to
the client. The difference is that a row now exists in every outcome.

### 1. Shared helpers — `src/lib/server/create-pending-generation.server.ts`

- Make `requestId` optional (column is already nullable).
- `markGenerationSubmitted(recordId, requestId)` — attach the id after submit.
- `markGenerationFailed(recordId, message)` — `status='failed'` +
  `generation_error`. Must use the **admin** client and must never throw; a
  failure to record a failure should not mask the original error.

### 2. Apply to all four paths

`generate-image-internal`, `edit-image-internal`, `generate-variation`,
`submit-variations` — identical treatment.

The `FAL_KEY` guard moves **inside** the try so it becomes a visible failed card
reading something like "FAL_KEY is not set — add it to .env.local and restart the
dev server", rather than an invisible throw.

Credits stay checked _before_ the row is reserved: insufficient credits already
has its own dialog (`showInsufficientCredits`), so it does not need a failed card.

### 3. Client feedback

- Surface the thrown error via the existing toast system
  (`src/components/ui/toast.tsx`, `<Toaster />` already mounted in `__root.tsx`) —
  the edit page's dead `setError` is the bug.
- Refetch after a failed submit so the new failed card appears without a reload.

## Verification

With `FAL_KEY` empty — the exact repro:

1. Edit page, 3 models, Generate 3 edits
2. **3 failed cards** appear, each naming the reason
3. Each has a working Retry
4. 3 entries in Activity
5. Credit balance unchanged (refunded)
6. A toast states what went wrong

Then repeat with a real `FAL_KEY` and confirm the success path still works.
