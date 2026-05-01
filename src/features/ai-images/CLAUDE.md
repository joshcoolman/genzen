# AI Images

Multi-model image generation with edit, variation, and reparenting workflows via FAL AI.

## Key Files

- `models.ts` -- model registry (FLUX, Kling, Seedream, GPT Image, etc.), `getModelName()`, `EDIT_MODELS`, `REFINE_CAPABLE_MODELS`; exports `KONTEXT_DEV_ID`, `KONTEXT_DEV_FALLBACK_ID`, `FLUX_KONTEXT_PRO_ID`, `LOCKED_IMAGE_MODEL_ID`; models have optional `locked` and `isNew` flags
- `types.ts` -- `SavedAiImage` interface (status, generation_metadata with parent/root tracking)
- `constants.ts` -- aspect ratio utilities (`RATIO_TO_SIZE`, `detectAspectRatio`)
- `error-classification.ts` -- `classifyError()` categorizes FAL errors as retryable vs permanent
- `index.ts` -- barrel exports: `SavedAiImage`, `getModelName`, `useAiImagesPage`, `GeneratorPanel`, `ImageGallery`, `ImageLightbox`

## Server

- `generate-image.server.ts` -- TanStack server fn wrapper for generation
- `generate-image-internal.server.ts` -- core async implementation for text-to-image and image-to-image (FAL + Google providers); called directly by MCP tools and other server fns to avoid TanStack RPC stub corruption
- `edit-image.server.ts` -- TanStack server fn wrapper for editing
- `edit-image-internal.server.ts` -- core async implementation for image editing with prompt + optional reference images; called directly by MCP tools
- `generate-variation.server.ts` -- Claude Sonnet rewrites prompt, generates via edit model
- `generate-variation-prompts.server.ts` -- Claude Sonnet generates variation prompts from root image
- `submit-variations.server.ts` -- batch submit variation prompts for generation
- `reparent-image.server.ts` -- move image under new parent or detach from parent
- `set-generation-parent.server.ts` -- set parent image for grouping (used by multi-model, scenes)
- `retry-generation.server.ts` -- resubmit failed image generation to FAL
- `caption-image.server.ts` -- vision API image captioning
- `generate-shot-list.server.ts` -- vision-based shot list prompt generation (Gemini Flash)
- `describe-image-json.server.ts` -- JSON structural description for reference DNA sheets
- `fal-params.server.ts` -- `buildFalInput()` resolves size/safety/image params per model schema
- `fal-schema.server.ts` -- fetches + caches FAL OpenAPI schemas at runtime
- `group-images.server.ts` -- group selected images under a new or existing parent
- `ungroup-images.server.ts` -- ungroup images by removing parent association
- `update-image-order.server.ts` -- reorder images via sort_order
- `enhance-prompt.server.ts` -- LLM-powered prompt enhancement via Claude Sonnet; loads the `enhance-prompt` AD skill as its system prompt, shared with the AD panel's skill chip

## Hooks

- `use-ai-images-page.ts` -- master hook composing all sub-hooks for the main page
- `use-generator.ts` -- prompt state, model selection, source image, ref images, generation submission, per-prompt LLM enhancement via `handleEnhancePrompt(index)`
- `use-images.ts` -- gallery fetch, polling, deletion, reordering, optimistic cards
- `use-variations.ts` -- variation prompt generation and submission with ref image support
- `use-lightbox.ts` -- fullscreen viewer with merged parent+child item list
- `use-edit-children.ts` -- fetch/display edit children nested under parent cards (max 8, R2 public URLs)
- `use-reparent.ts` -- adopt/detach images between parents
- `use-describe-json.ts` -- JSON structural description for reference DNA sheets
- `use-edit-page.ts` -- dedicated edit page state (source loading via server-side base64 fetch, aspect ratio, variants, parent picker)
- `useAiImagesADContext.ts` -- registers AI Images context with AD system
- `useEditPageADContext.ts` -- registers edit page context with AD system

## Components

- `GeneratorPanel.tsx` -- main prompt input, aspect ratio, model selector, ref images, generation controls
- `ImageGallery.tsx` -- image grid with nested edit children thumbnails under parent cards
- `ImageLightbox.tsx` -- fullscreen lightbox viewer
- `ImageCard.tsx` -- single image card with model label, root preview, edit children grid, actions menu
- `PendingImageCard.tsx` -- skeleton card during generation
- `FailedImageCard.tsx` -- error card with retry (if retryable)
- `DescribeDialog.tsx` -- auto-generate or edit image captions via vision API
- `VariationPromptsDialog.tsx` -- manage variation prompts with ref image picker; supports smart paste (multi-line text splits into prompts)
- `GeneratePromptsDialog.tsx` -- generate shot list prompts from images via vision API
- `PastePromptsDialog.tsx` -- paste/import bulk prompts for batch generation
- `ParentPickerDialog.tsx` -- select new parent when adopting/moving an image
- `GroupPickerDialog.tsx` -- select target group for reparenting
- `DescribeJsonPanel.tsx` -- JSON description output with syntax highlighting

## Routes

- `src/routes/dashboard/ai-images.tsx` -- main gallery + generation page
- `src/routes/dashboard/edit.$imageId.tsx` -- dedicated edit page for a single image

## Shared Dependencies

- `src/lib/server/auth.server.ts` -- `requireAuth()`
- `src/lib/server/ai.server.ts` -- `models.haiku`, `models.sonnet` Vercel AI SDK instances
- `src/lib/server/describe-image.server.ts` -- vision description for images without prompts
- `src/lib/prompts/image-variation.ts` -- system prompt + user content builder for variations
- `src/lib/prompts/shot-list.ts` -- system prompt for shot list generation
- `src/components/PromptList.tsx` -- reusable prompt list with optional AI generation
- `src/features/credits/` -- credit checking, deduction, and UI
- `src/features/user-images/` -- `useUserImages` for image picker
- `src/lib/server/fetch-image-base64.server.ts` -- server-side image-to-base64 (avoids R2 CORS in edit page)
- `src/components/AspectRatioSelect.tsx` -- ratio constants re-exported via `constants.ts`

## Quirks / Notes

- Variations use Claude Sonnet to rewrite prompts with "creative tension" -- always references the root image, not the immediate parent, to prevent quality drift
- `fal-params.server.ts` is the central param resolver used by many features (outpaint, describe, edit-image)
- Models with `supportsImageInput` can do image-to-image; `imageInputModelId` maps to their edit endpoint
- FAL submissions use async queue (`fal.queue.submit`) -- results polled by gallery hook
- Some models (GPT Image 1.5, GPT Image 2) use resolution enum strings, others use width/height objects -- handled by `buildFalInput()`
- Edit children are displayed as nested thumbnails under parent cards in the gallery, with a dedicated lightbox that flattens the parent+children list
- Reparenting allows moving images between parent groups or detaching from a parent entirely
- `set-generation-parent.server.ts` is used by multi-model and scenes features to group their outputs
