# Multi-Model

Side-by-side 3×3 grid for comparing 9 AI models simultaneously on a single prompt.

## Key Files

- `types.ts` — `ModelCellState`, `MultiModelState` interfaces
- `constants.ts` — `DEFAULT_COMPARE_MODEL_IDS` (9 models), `MULTI_MODEL_STORAGE_KEY`
- `hooks/use-multi-model.ts` — master hook: cell state, generation, polling, realtime, lightbox
- `components/ModelShotCell.tsx` — single cell wrapping `Thumbnail`, model picker, slideshow, run button
- `components/MultiModelGrid.tsx` — 3×3 grid of `ModelShotCell`
- `components/MultiModelPanel.tsx` — left panel: system prompt, user prompt, aspect ratio, source image, generate all
- `components/MultiModelPage.tsx` — assembles `TwoColumnLayout` + `Lightbox`
- `index.ts` — barrel exports

## Route

`/dashboard/dev-workspace/multi-model` — added to `DEV_NAV_ITEMS` in `dev-workspace.tsx`

## Shared Components

- `src/components/DescribeImageButton` — self-contained icon button that calls `captionImage` and returns a caption via `onCaption` callback
- `src/components/ModelPickerButton` — single-select dropdown showing model name + description per item, opens upward

## Source Image Persistence

Library images selected via the picker are persisted across page refreshes:

- Stores `source-image-id` and `source-image-name` in localStorage under `MULTI_MODEL_STORAGE_KEY`
- On mount, restores by querying `user_images` for a fresh signed URL and converting to base64
- File uploads are NOT persisted — clearing or refreshing removes them (expected behavior)
- `clearAll` and `clearSourceImage` both delete the persisted source image keys

## Generation Grouping

Generated images are linked in the AI Images gallery:

- **Library source image**: all generated images have `source_image_id = sourceImage.id` and `generation_type = 'variation'` set at generation time via `generateImage({ parentImageId })`
- **No source / file upload**: after all cells complete, the first succeeded image becomes the parent, and the rest are updated via `setGenerationParent` (best-effort, non-blocking)
- This causes all images to appear nested under a parent in the gallery

## Patterns

- Generations land in existing `user_images` table (appear in AI Images gallery too)
- Polling via `checkPendingGenerations` every 5s while any cell has `pendingId !== null`
- Supabase realtime `UPDATE` subscription resolves pending cells and fetches signed URLs
- Kontext Dev falls back to FLUX Dev when no source image is provided
- Prompts (system + user) persisted to localStorage under `genzen:multi-model:*` keys
- `clearAll` wipes cells, prompts, source image, and all localStorage keys
- Lightbox flattens all completed generations across all cells in row-major order
