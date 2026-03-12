# Continue: Focused Edit Mode + Edit Chaining

## What was being worked on

Branch: `focused-edit-mode` — focused edit workflow at `/dashboard/edit/$imageId`, regenerate with different model, and edit chaining (promote result as new source).

## Changes made so far

**Focused Edit Mode (bulk of the diff):**

- New route `src/routes/dashboard/edit.$imageId.tsx` — dedicated edit page per image
- New component `src/features/ai-images/components/FocusedEditView.tsx` — source image preview, edit prompt textarea (height matches image), aspect ratio + model selectors, Generate Edit button, previous edits grid
- New hook `src/features/ai-images/hooks/use-focused-edit.ts` — fetches source image from Supabase, detects aspect ratio, manages edit prompt/model state, calls `editImage()` server fn
- New hook `src/features/ai-images/hooks/use-edit-children.ts` — fetches child edit images for a given source image
- Deleted `EditImageDialog.tsx` and `use-editor.ts` — replaced by focused edit approach

**Edit Image Server Changes:**

- `src/features/ai-images/server/edit-image.server.ts` — accepts `sourceImageId`, `editPrompt`, `aspectRatio`, `editModelId`
- `src/lib/server/fal-image-upload.server.ts` — FAL image upload utility

**Regenerate with Different Model:**

- `GenerationResultsGrid.tsx` — `onRegenerate` + `regenerateModels` props; `RegenerateButton` with `RefreshCw` icon + model popover on complete results with prompts
- `use-focused-edit.ts` — `handleRegenerate(prompt, modelId)` deducts credits, calls `editImage()`, adds pending result

**Edit Chaining (Promote Result as Source) — latest work:**

- `src/lib/hooks/useGenerationResults.ts` — changed `sourceImageId?: string` to `sourceImageIds?: string[]`; DB load filter and realtime filter now check against array of IDs; channel name uses joined IDs
- `src/features/ai-images/hooks/use-focused-edit.ts` — added `activeSourceId` (defaults to `imageId`), `sourceChain: string[]` (starts as `[imageId]`), `originalImage` state; `handleSubmit`/`handleRegenerate` use `activeSourceId` instead of `imageId`; new `promoteToSource(result)` fetches metadata from Supabase, swaps source image display, appends to chain, detects aspect ratio; new `resetToOriginal()` restores original source; exports `isChained` boolean
- `src/features/ai-images/components/FocusedEditView.tsx` — "Reset to Original" button (with `RotateCcw` icon) appears in toolbar when `isChained`; `onAdd` wired to `promoteToSource` on `GenerationResultsGrid`
- `src/components/GenerationResultsGrid.tsx` — already had `onAdd` prop with Plus button (no changes needed this session)

**Other changes in the diff (from prior work on this branch):**

- `ImageCard.tsx` / `ImageGallery.tsx` — "Edit" action navigates to `/dashboard/edit/$imageId`
- `use-ai-images-page.ts` — removed old editor hook usage
- `DashboardLayout.tsx` / `Sidebar.tsx` / `use-sidebar-collapsed.ts` — sidebar refinements
- `generation-result.ts` — added `prompt` and `title` fields to `GenerationResult` type
- `combine/` — combine feature server + hook updates
- `src/lib/prompts/edit-enhancement.ts` + `src/lib/prompts/index.ts` — edit prompt enhancement system prompt
- `routeTree.gen.ts` — auto-generated, includes new edit route

## Key decisions

- `sourceImageIds` is an array so chained edits (different `source_image_id` values) all appear in the same grid
- `sourceChain` only grows — promoting a result appends its ID, never removes previous IDs, so all edits remain visible
- `resetToOriginal` restores the original image display and resets `activeSourceId` but does NOT shrink `sourceChain` — all chained edits stay visible in the grid
- Regenerate button uses `imageOverlay` prop (inside image area) rather than `overlayActions` (top-right hover)
- Promote button uses existing `onAdd` prop / Plus icon on `GenerationResultsGrid`

## Known issues / outstanding work

- **Not committed** — all changes unstaged on `focused-edit-mode` branch
- `pnpm build` passes clean
- Visual verification needed: test the full chain flow (edit -> promote -> edit again -> reset)
- The Plus "Use as Source" button appears on all results in any grid that passes `onAdd` — may want to restrict to only complete results with URLs (currently handled in `GenerationResultCard`)
- Consider: visual indicator on the source image showing it's a promoted result (not the original)
- Consider: showing which model was used on each result card

## Git state

- Branch: `focused-edit-mode`
- All changes uncommitted/unstaged
- Last commit: `45ce0c1 Merge branch 'update-shots'`
- Build passes
