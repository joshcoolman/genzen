# Continue: Unified Sidebar Model Selector

## Branch: `main` -- NOT committed, 13 files changed

## What was done

Replaced the Draft/Quality `TierToggle` in the sidebar `GeneratorPanel` with a unified multi-select `ModelSelector` dropdown showing all 6 image-capable models. This is the sidebar-only pass; the focused edit view was intentionally left unchanged.

## Changes made

### Model registry (`src/features/ai-images/models.ts`)

- Added `GPT Image 1.5` (`fal-ai/gpt-image-1.5`, edit: `fal-ai/gpt-image-1.5/edit`) to `ALL_IMAGE_MODELS`
- Added `Seedream v4.5` (`fal-ai/bytedance/seedream/v4.5/text-to-image`, edit: `.../v4.5/edit`) to `ALL_IMAGE_MODELS`
- Updated `maxRefImages`: FLUX.2 Pro Edit 8->9, Seedream v4 4->10, Seedream v4.5 9->10

### ModelSelector abstraction (`src/components/ModelSelector/`)

- Added `'sidebar'` to `ModelCapability` type union
- Added `editId?: string` to `UnifiedModel` interface
- Created `UNIFIED_SIDEBAR_MODELS` list -- maps `IMAGE_INPUT_MODELS` to UnifiedModel with editId + maxRefImages from EDIT_MODELS
- Updated `getModelsByCapability()` and `getDefaultSelectedId()` for `'sidebar'`
- `useModelSelector` now computes `maxRefImages` for `'sidebar'` capability too
- Removed "Gens" label text from the gens stepper control in `ModelSelector.tsx`

### Sidebar wiring

- `use-ai-images-page.ts` -- replaced `useModelSlots()` + `activeTier` state with `useModelSelector({ capability: 'sidebar', mode: 'multi' })`. Returns `modelSelector` instead of `slots`/`activeTier`/`setActiveTier`/`activeModelId`/`gensPerModel`/`adjustGens`
- `use-generator.ts` -- removed `activeTier` from options. `maxRefImages` now computed from `sourceImage` presence + selected model's edit endpoint (not tier). `handleGenerate` routes to edit endpoint when source image present and model has `imageInputModelId`
- `GeneratorPanel.tsx` -- removed `TierToggle` entirely. Added `<ModelSelector display="dropdown">` below generate button. Added `<NumberStepper>` next to generate button (no label). Ref image strip condition: `sourceImage && maxRefImages > 0` (was `activeTier === 'quality'`)
- `ai-images.tsx` route -- passes `modelSelector` prop instead of old tier/slot props
- `useAiImagesADContext.ts` -- uses `modelSelector.selectedIds` instead of `activeModelId`

## Key decisions

- `'sidebar'` capability is separate from `'generate'` -- sidebar only shows image-input-capable models (6), generate shows all models (10+)
- Kontext Dev: no ref images (maxRefImages=0), uses img2img directly. Falls back to FLUX Dev for text-only
- Edit endpoint routing happens in `handleGenerate` -- if sourceImage present and model has `imageInputModelId`, uses edit endpoint instead of text-to-image
- `model-slots.ts` left intact (still used by video features)
- NumberStepper moved next to Generate button, no "Gens" label

## Outstanding work / next steps

### Focused edit view -- same pattern (deferred)

The focused edit view still uses its own model selector pattern. Apply the same unified approach there in a follow-up pass.

### Verify FAL model IDs

The two new model IDs (`fal-ai/gpt-image-1.5`, `fal-ai/bytedance/seedream/v4.5/text-to-image`) were added per the plan but should be verified against FAL's API to confirm they're correct endpoint IDs. Use the `fal-models` skill.

## Git state

All changes are uncommitted and unstaged on `main`. Build passes (`pnpm build` succeeds). Run `pnpm check` before committing.
