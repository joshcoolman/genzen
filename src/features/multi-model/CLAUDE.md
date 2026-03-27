# Multi-Model

Side-by-side 3x3 grid for comparing 9 AI models simultaneously on a single prompt.

## Key Files

- `types.ts` -- `ModelCellState`, `LibraryImage`, `MultiModelState` interfaces
- `constants.ts` -- `DEFAULT_COMPARE_MODEL_IDS` (9 models), `MULTI_MODEL_STORAGE_KEY`, Kontext Dev fallback constants
- `hooks/use-multi-model.ts` -- master hook (~705 lines): cell persistence, single/batch generation, polling, realtime, lightbox, source image hydration
- `components/ModelShotCell.tsx` -- single cell: square preview (loading/failed states), model picker, enable toggle, generation slideshow, re-run button
- `components/MultiModelGrid.tsx` -- 3x3 grid of `ModelShotCell`
- `components/MultiModelPanel.tsx` -- left sidebar: system prompt, user prompt, aspect ratio + orientation, source image, upload/library/describe, generate all
- `components/MultiModelPage.tsx` -- page layout: clipboard paste handler, `TwoColumnLayout`, conditional `Lightbox`
- `index.ts` -- barrel exports

## Route

`/dashboard/dev-workspace/multi-model` -- added to `DEV_NAV_ITEMS` in `dev-workspace.tsx`

## Shared Components

- `src/components/DescribeImageButton` -- vision-based image captioning
- `src/components/ModelPickerButton` -- single-select model dropdown
- `src/components/AspectRatioSelect` -- aspect ratio and orientation controls
- `src/components/ImageSourceButtons` -- file upload, library picker
- `src/components/SourceImagePreview` -- compact preview with remove button
- `src/components/TwoColumnLayout` -- two-column page structure
- `src/components/Lightbox` -- image viewer with nav

## Source Image Persistence

- Stores `source-image-id` and `source-image-name` in localStorage under `MULTI_MODEL_STORAGE_KEY`
- On mount, restores by querying `user_images` for fresh signed URL (400w transform) and converting to base64
- File uploads are NOT persisted -- clearing or refreshing removes them
- `clearAll` and `clearSourceImage` both delete persisted source image keys

## State Persistence

All persisted to localStorage under `genzen:multi-model:*`:
- Prompts (system + user), aspect ratio, orientation
- Cells array (model IDs, enabled state, generations, current slide); pending records filtered on load

## Generation Grouping

- **Library source image**: all generated images have `parentImageId = sourceImage.id` and `generation_type = 'variation'`
- **No source / file upload**: first succeeded image becomes parent, rest grouped via `setGenerationParent` (best-effort)
- Images appear nested under a parent in the AI Images gallery

## Credit System

- Before generation, checks balance against cost (`variation` if source image, else `image_gen`)
- Shows insufficient credits dialog via `credits.showInsufficientCredits(cost)`

## Patterns

- Polling via `checkPendingGenerations` every 5s while any cell has `pendingId !== null`
- Supabase realtime `UPDATE` subscription resolves pending cells and fetches signed URLs
- Kontext Dev falls back to FLUX Dev when no source image is provided
- `clearAll` wipes cells, prompts, source image, signed URLs, and all localStorage keys
- Lightbox flattens all completed generations across all cells in cell order (0-8)
