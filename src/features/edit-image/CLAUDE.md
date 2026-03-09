# Edit Image

Dedicated edit page for multi-model image editing with reference image support.

## Key Files

- `types.ts` -- `SelectedImage`, `EditResult` interfaces
- `hooks/useEditPage.ts` -- master hook composing source image, models, results, and ref images
- `hooks/useEditModels.ts` -- model selection with `maxRefImages` derived from selected models
- `hooks/useEditResults.ts` -- submits edits across multiple models, polls for results
- `hooks/useEditSourceImage.ts` -- source image selection (upload or library), auto-detects aspect ratio
- `components/EditPageContent.tsx` -- main page layout
- `components/EditResultCard.tsx` -- individual result card
- `components/EditResultsGrid.tsx` -- results grid display
- `index.ts` -- barrel export

## Route

`src/routes/dashboard/edit-image.tsx`

## Shared Dependencies

- `src/features/ai-images/models.ts` -- `EDIT_MODELS`, `DEFAULT_EDIT_MODEL`, `getModelName()`
- `src/features/ai-images/server/edit-image.server.ts` -- actual FAL edit submission (shared with ai-images feature)
- `src/features/ai-images/constants.ts` -- `detectAspectRatio()`
- `src/features/describe/hooks/useExistingImages.ts` -- fetches user's image library for source/ref picker
- `src/features/describe/hooks/useImageUpload.ts` -- upload new source images
- `src/features/describe/lib/file-hash.ts` -- SHA-256 hash for dedup
- `src/features/describe/lib/filename-parser.ts` -- title extraction from filenames
- `src/features/describe/types.ts` -- `CollectedImage` type for reference images
- `src/features/credits/` -- credit checking and balance display
- `src/lib/hooks/useGenerationResults.ts` -- shared polling hook for pending results

## Quirks / Notes

- Has no server files of its own -- delegates to `ai-images/server/edit-image.server.ts`
- Supports multi-model comparison: select multiple edit models and generate in parallel
- `maxRefImages` is the minimum across all selected models (each model has different limits, up to 14 for nano-banana-2)
- Reference images are capped dynamically when model selection changes
