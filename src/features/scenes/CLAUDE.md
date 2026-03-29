# Scenes

A 3x3 grid of 9 cells for generating multiple camera-angle variations of a source image. Distills the node-based workflow: source image -> AI-generated camera-angle prompts (Claude vision) -> parallel image generation (Nano Banana 2 / FAL).

## Key Files

- `types.ts` -- `SceneCellState`, `LibraryImage`, `ScenesState` interfaces
- `constants.ts` -- `SCENE_CELL_COUNT` (9), `DEFAULT_SCENE_MODEL_ID`, `SCENE_STORAGE_KEY`, `SCENE_SYSTEM_PROMPT`
- `hooks/use-scenes.ts` -- master hook (~750 lines): per-cell prompts, global model, generation, polling, realtime, lightbox, library image loading
- `server/generate-scene-prompts.server.ts` -- Claude vision -> 9 camera angle prompts (free, no credits)
- `components/SceneCell.tsx` -- single cell: prompt textarea, square image preview (with slideshow nav for multiple generations), regen buttons
- `components/ScenesGrid.tsx` -- 3x3 grid of `SceneCell`
- `components/ScenesPanel.tsx` -- left panel: source image, model picker, aspect ratio/orientation, generate prompts/images buttons
- `components/ScenesPage.tsx` -- assembles `TwoColumnLayout` + `Lightbox` + clipboard paste handler
- `index.ts` -- barrel exports

## Route

`/dashboard/scenes` -- main nav item with `Camera` icon

## Workflow

1. Upload or select source image from library (or paste via clipboard)
2. Click "Generate Prompts" -> Claude vision generates 9 distinct camera angle prompts
3. Edit individual prompts via per-cell textareas
4. Click "Generate Images" -> all non-empty cells generate in parallel
5. Use wand icon per cell to regenerate a single prompt
6. Use refresh icon per cell to regenerate a single image
7. Use slideshow arrows (when multiple generations exist) to browse prior versions

## Key Differences from Multi-Model

- Per-cell prompts (not shared prompt) -- each cell has its own textarea
- Global model picker (not per-cell) -- defaults to Nano Banana 2
- Two-step workflow: Generate Prompts -> Generate Images
- No `isEnabled` toggle per cell -- cells with empty prompts are skipped
- `generatePrompts` calls `generateScenePrompts` server fn (Claude vision, no credits)
- `regenerateCellPrompt` generates a single replacement prompt
- Source-free text mode: when no source image, uses `textPrompt` for generation directly

## State Persistence

Persisted to localStorage under `genzen:scenes:*`: cells, model, aspect ratio, orientation, text prompt, source image (if from library). R2 public URLs hydrated on mount.

## Patterns

Same as multi-model: polling via `checkPendingGenerations`, Supabase realtime channel `scenes_user_images`, library source image persistence, generation grouping via `setGenerationParent`.
