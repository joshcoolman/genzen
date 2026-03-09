# Describe

Describe an image with AI vision, then regenerate it with a different model.

## Key Files

- `types.ts` -- `CollectedImage`, `CreateUserImageInput`, Zod validation schemas
- `server/describe-image.server.ts` -- AI vision description via shared `describeImage()` helper
- `server/generate-from-description.server.ts` -- generate image from description prompt via FAL
- `server/save-generated-image.server.ts` -- download FAL result, upload to Supabase storage
- `hooks/useDescribePage.ts` -- master hook composing existing images + describer
- `hooks/useImageDescriber.ts` -- full pipeline: select image -> describe -> generate (auto-advancing state machine)
- `hooks/useExistingImages.ts` -- fetch user's existing images + signed URLs
- `hooks/useImageUpload.ts` -- Supabase storage upload + DB insert
- `lib/file-hash.ts` -- SHA-256 via Web Crypto
- `lib/filename-parser.ts` -- title extraction from filenames
- `components/DescribePageContent.tsx` -- page layout
- `components/ImageDescriberCard.tsx` -- pipeline UI with paste/upload/library inputs
- `components/ExistingImagePicker.tsx` -- dialog with source filter tabs, checkbox select
- `index.ts` -- barrel export

## Route

`src/routes/dashboard/describe.tsx`

## Shared Dependencies

- `src/lib/server/describe-image.server.ts` -- shared vision description (used in "reconstruct" mode here)
- `src/features/ai-images/server/fal-params.server.ts` -- `buildFalInput()` for generation
- `src/features/ai-images/models.ts` -- `getModelName()` for result labels
- `src/features/credits/` -- credit checking and deduction
- `src/lib/hooks/useGenerationResults.ts` -- shared polling hook for pending results
- `src/lib/server/create-pending-generation.server.ts` -- shared DB record creation

## Quirks / Notes

- `useImageDescriber` is a state machine: idle -> describing -> generating -> pending. Transitions are automatic -- selecting an image immediately starts the describe -> generate pipeline
- Has its own model list (`DESCRIBER_MODELS` in `useImageDescriber.ts`) separate from the main `ALL_IMAGE_MODELS` -- includes Imagen models not in the main list
- `types.ts` and `lib/` utilities are imported by `edit-image` feature (not self-contained despite original intent)
- `useExistingImages` and `useImageUpload` are also consumed by `edit-image` feature
