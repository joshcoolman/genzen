Combine multiple images into one using FAL AI image generation.

## Key Files

- `hooks/useCombinePage.ts` -- Page state: source images, prompt, model, orientation, generation lifecycle
- `server/combine-images.server.ts` -- Server function: uploads images to FAL storage, queues generation, creates pending record
- `components/CombinePageContent.tsx` -- Layout: CombineCard + GenerationResultsGrid
- `components/CombineCard.tsx` -- Controls: image sources, prompt textarea, aspect ratio, model select, generate button

## Route

`src/routes/dashboard/combine.tsx`

## Shared Dependencies

- `@/features/ai-images/models` -- EDIT_MODELS list and getModelName
- `@/features/ai-images/constants` -- RATIO_TO_SIZE mapping
- `@/features/describe/types` -- CollectedImage type
- `@/features/describe/hooks/useExistingImages` -- Fetches user's image library for picker
- `@/features/describe/components/ExistingImagePicker` -- Library image selection dialog
- `@/features/credits` -- CREDIT_COSTS, isCreditError
- `@/features/credits/hooks/use-credits` -- Balance check and insufficient credits dialog
- `@/features/credits/server/check-credits.server` -- Server-side credit deduction
- `@/lib/hooks/useGenerationResults` -- Polling hook for pending/completed generations
- `@/lib/server/auth.server` -- requireAuth
- `@/lib/server/create-pending-generation.server` -- Creates DB record + triggers polling
- `@/components/GenerationResultsGrid` -- Displays generation results with status
- `@/components/ImageSourceButtons` -- File/camera upload buttons
- `@/components/AspectRatioSelect` -- Orientation + ratio picker
- `@/components/ModelSelect` -- Single model dropdown

## Quirks / Notes

- Requires at least 2 source images to enable generation
- Blob URLs (from file picker) are converted to base64 data URLs before sending to server
- Server detects image MIME type by inspecting magic bytes, not Content-Type header
- Uses FAL queue.submit (async) not run (sync) -- results arrive via polling
- Model list reuses EDIT_MODELS from ai-images feature (not generate models)
