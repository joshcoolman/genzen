# AI Images

Multi-model image generation with brainstorm, edit, and variation workflows via FAL AI.

## Key Files

- `models.ts` -- all image model + edit model definitions, `getModelName()`, `EDIT_MODELS`
- `types.ts` -- `SavedAiImage` interface (status, generation_metadata)
- `constants.ts` -- aspect ratio utilities, `RATIO_TO_SIZE`, brainstorm settings
- `server/generate-image.server.ts` -- text-to-image and image-to-image generation via FAL queue
- `server/edit-image.server.ts` -- edit existing image with prompt + optional reference images
- `server/generate-variation.server.ts` -- Claude Sonnet rewrites prompt, generates via nano-banana-2/edit
- `server/brainstorm-images.server.ts` -- batch prompt generation + rewriting via Haiku
- `server/fal-params.server.ts` -- `buildFalInput()` resolves size/safety/image params per model schema
- `server/fal-schema.server.ts` -- fetches + caches FAL OpenAPI schemas at runtime
- `server/generate-prompt.server.ts` -- AI prompt generation
- `server/generate-prompt-enhanced.server.ts` -- enhanced prompt generation
- `server/caption-image.server.ts` -- image captioning
- `server/check-pending-images.server.ts` -- polls FAL queue for pending image results
- `server/update-image-order.server.ts` -- reorder images in gallery
- `hooks/use-ai-images-page.ts` -- master hook composing all sub-hooks
- `hooks/use-generator.ts` -- prompt state, model selection, generation submission
- `hooks/use-editor.ts` -- edit dialog state and submission
- `hooks/use-brainstorm.ts` -- brainstorm panel state and polling
- `hooks/use-variations.ts` -- variation generation from existing images
- `hooks/use-images.ts` -- gallery fetch, polling, deletion
- `hooks/use-lightbox.ts` -- fullscreen image viewer state
- `hooks/use-model-settings.ts` -- visible/selected model management
- `hooks/use-prompt-tools.ts` -- prompt rewrite/edit tools
- `hooks/use-brainstorm-settings.ts` -- brainstorm config (row count, images per prompt)
- `components/GeneratorPanel.tsx` -- main prompt input and generation controls
- `components/BrainstormPanel.tsx` -- batch brainstorm grid UI
- `components/ImageGallery.tsx` -- image grid with drag reorder
- `components/EditImageDialog.tsx` -- dialog for editing existing images
- `components/ModelSettingsDialog.tsx` -- model visibility/selection config
- `components/ImageLightbox.tsx` -- fullscreen image viewer
- `components/ImageCard.tsx` -- single image card with actions
- `components/PendingImageCard.tsx` -- loading placeholder during generation
- `components/FailedImageCard.tsx` -- error state card
- `index.ts` -- barrel export

## Route

`src/routes/dashboard/ai-images.tsx`

## Shared Dependencies

- `src/lib/server/auth.server.ts` -- `requireAuth()`
- `src/lib/server/ai.server.ts` -- `ai.haiku`, `ai.sonnet` model instances
- `src/lib/server/describe-image.server.ts` -- vision description for images without prompts
- `src/lib/prompts/image-variation.ts` -- system prompt + user content builder for variations
- `src/features/credits/` -- credit checking, deduction, and UI
- `src/features/user-images/` -- `useUserImages` for image picker
- `src/components/AspectRatioSelect.tsx` -- ratio constants re-exported via `constants.ts`

## Quirks / Notes

- Variations use Claude Sonnet to rewrite prompts with "creative tension" -- always references the root image, not the immediate parent, to prevent quality drift
- Brainstorm uses FLUX Schnell/Dev only (not the full model list) for fast iteration
- `fal-params.server.ts` is the central param resolver used by many features (outpaint, describe, edit-image)
- Models with `supportsImageInput` can do image-to-image; `imageInputModelId` maps to their edit endpoint
- FAL submissions use async queue (`fal.queue.submit`) -- results polled via `check-pending-images`
- Some models (GPT Image 1.5) use resolution enum strings, others use width/height objects -- handled by `buildFalInput()`
