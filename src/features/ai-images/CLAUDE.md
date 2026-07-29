# Images

Multi-model image generation with edit and variation workflows via FAL AI.

## Key Files

- `models.ts` -- **the lineup.** `IMAGE_MODELS` is one entry per model and the
  only place to add or remove one; everything else in the file is derived from
  it. A model is one name over up to two FAL endpoints -- `textToImage` (no
  references) and `withImages` (references attached) -- picked by
  `endpointFor(id, hasRefs)`, with `maxRefs` capping how many are sent.
  `getModelName()` resolves either endpoint, because `images.model` stores the
  resolved one. `ALL_IMAGE_MODELS`, `IMAGE_INPUT_MODELS` and `EDIT_MODELS` are
  the legacy shape, still consumed, being retired by #190
- `types.ts` -- `SavedAiImage` interface (status, generation_metadata with parent/root tracking)
- `constants.ts` -- aspect ratio utilities (`RATIO_TO_SIZE`, `detectAspectRatio`)
- `error-classification.ts` -- `classifyError()` categorizes FAL errors as retryable vs permanent
- `index.ts` -- barrel exports: `SavedAiImage`, `getModelName`, `normalizeGeneration`

## Server

- `gallery.actions.ts` -- the gallery's reads and deletes, user-scoped by `resolveAuth()`: `listGalleryImages`, `deleteGalleryImage` (soft-delete; a failed row is destroyed outright)
- `generate-image.server.ts` -- TanStack server fn wrapper for generation
- `generate-image-internal.server.ts` -- core async implementation for text-to-image and image-to-image (FAL + Google providers); called directly by other server fns to avoid TanStack RPC stub corruption; computes `estimated_cost_cents` via `computeFalCostCents` before FAL submit
- `generate-variation.server.ts` -- Claude Sonnet rewrites prompt, generates via edit model
- `generate-variation-prompts.server.ts` -- Claude Sonnet generates variation prompts from root image
- `submit-variations.server.ts` -- batch submit variation prompts for generation
- `retry-generation.server.ts` -- resubmit a failed generation **on the same row**: back to `pending`, error cleared, `retry_count` bumped. Retry means "try that again", not "make another" -- inserting a new row left the original failure behind as a second card to clean up
- `caption-image.server.ts` -- vision API image captioning
- `generate-shot-list.server.ts` -- vision-based shot list prompt generation (Gemini Flash)
- `describe-image-json.server.ts` -- JSON structural description for reference DNA sheets
- `fal-params.server.ts` -- `buildFalInput()` resolves size/safety/image params per model schema
- `fal-schema.server.ts` -- fetches + caches FAL OpenAPI schemas at runtime
- `update-image-order.server.ts` -- reorder images via sort_order
- `enhance-prompt.server.ts` -- LLM-powered prompt enhancement via Claude Sonnet; its system prompt is `src/lib/prompts/enhance-prompt.md`, imported as raw text

## Hooks

Two, because two routes use them. Everything else this feature used to hold
moved to `app/(authenticated)/images/_hooks/` in #189 -- Images was the only
consumer, and `features/` is earned by two.

- `use-generator.ts` -- prompt state, model selection, source image, ref images, generation submission, per-prompt LLM enhancement via `handleEnhancePrompt(index)`. Shared with canvas
- `use-describe-json.ts` -- JSON structural description for reference DNA sheets. Only Images calls it, but the shared `generator-panel` takes its return value as a prop, so it stays here with the panel's other dependencies

## Routes and UI

- `app/(authenticated)/images/` -- the gallery and the generator, built to
  `docs/reference/route-shape.md` (#189). There is no edit route: a highlighted
  image is the next prompt's primary reference (#205), so an edit is a
  generation with a source, not a place you go

This feature is headless. The generation UI **shared with canvas** lives in
`app/(authenticated)/_components/` -- `generator-panel/` and what it composes:
`model-selector/`, `existing-image-picker/`, `prompt-list/`,
`generate-prompts-dialog/`, `paste-prompts-dialog/`. Everything Images alone
renders is in `app/(authenticated)/images/_components/`.

## Shared Dependencies

- `src/lib/server/auth.server.ts` -- `requireAuth()`
- `src/lib/server/ai.server.ts` -- `models.haiku`, `models.sonnet` Vercel AI SDK instances
- `src/lib/server/describe-image.server.ts` -- vision description for images without prompts
- `src/lib/prompts/image-variation.ts` -- system prompt + user content builder for variations
- `src/lib/prompts/shot-list.ts` -- system prompt for shot list generation
- `src/features/user-images/` -- `useUserImages` for image picker
- `src/lib/server/fetch-image-base64.server.ts` -- server-side image-to-base64 (avoids R2 CORS on library sources)
- `src/lib/server/compute-cost.server.ts` -- `computeFalCostCents()` for pre-submit cost estimation (FAL pricing cache + live API)
- `#/components` -- `AspectRatioSelect` and its ratio constants, re-exported via `constants.ts`

## Quirks / Notes

- Variations use Claude Sonnet to rewrite prompts with "creative tension", always against the source image, to prevent quality drift
- `fal-params.server.ts` is the central param resolver used across the image server fns (generate, edit, variations, retry) and `media.server.ts`
- A model with `withImages` set can do image-to-image; `supportsImageInput` and `imageInputModelId` are the derived legacy view of that
- FAL submissions use async queue (`fal.queue.submit`) -- results polled by gallery hook. The poll is also the gallery's only update signal: a submit refreshes once via `onAfterSubmit` so the pending cards appear, and each poll that settles a row refreshes again. Nothing pushes.
- Some models (GPT Image 1.5, GPT Image 2) use resolution enum strings, others use width/height objects -- handled by `buildFalInput()`
- **Failed generations are deleted outright, not soft-deleted.** There is no image to restore, so Trash has nothing to offer for one -- restoring it just puts an error card back. Everything else still soft-deletes.
- A row is titled `Generating...` while reserved; success renames it to the model and so does failure (`failureTitle`). Before that, a failure kept the placeholder forever, so Trash filled with rows that all read "Generating..."
