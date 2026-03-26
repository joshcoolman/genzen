# Scenes

A 3×3 grid of 9 cells for generating multiple camera-angle variations of a source image. Distills the node-based workflow: source image → AI-generated camera-angle prompts (Claude vision) → parallel image generation (Nano Banana 2 / FAL).

## Key Files

- `types.ts` — `SceneCellState`, `ScenesState` interfaces
- `constants.ts` — `SCENE_CELL_COUNT` (9), `DEFAULT_SCENE_MODEL_ID`, `SCENE_STORAGE_KEY`, `SCENE_SYSTEM_PROMPT`
- `hooks/use-scenes.ts` — master hook: per-cell prompts, global model, generation, polling, realtime, lightbox
- `server/generate-scene-prompts.server.ts` — Claude vision → camera angle prompts (free, no credits)
- `components/SceneCell.tsx` — single cell: prompt textarea + image preview + regen buttons
- `components/ScenesGrid.tsx` — 5×2 grid of `SceneCell`
- `components/ScenesPanel.tsx` — left panel: source image, model picker, generate prompts/images
- `components/ScenesPage.tsx` — assembles `TwoColumnLayout` + `Lightbox` + paste handler
- `index.ts` — barrel exports

## Route

`/dashboard/scenes` — main nav item with `Camera` icon

## Workflow

1. Upload or select source image from library
2. Click "Generate Prompts" → Claude vision generates 10 distinct camera angle prompts
3. Edit individual prompts via per-cell textareas
4. Click "Generate Images" → all non-empty cells generate in parallel
5. Use wand icon per cell to regenerate a single prompt
6. Use refresh icon per cell to regenerate a single image

## Key Differences from Multi-Model

- Per-cell prompts (not shared prompt) — each cell has its own textarea
- Global model picker (not per-cell) — defaults to Nano Banana 2
- Two-step workflow: Generate Prompts → Generate Images
- No `isEnabled` toggle per cell — cells with empty prompts are skipped
- `generatePrompts` calls `generateScenePrompts` server fn (Claude Haiku vision, no credits)
- `regenerateCellPrompt` generates a single replacement prompt

## Patterns

Same as multi-model: localStorage under `genzen:scenes:*`, polling via `checkPendingGenerations`, Supabase realtime channel `scenes_user_images`, signed URL hydration on mount, library source image persistence, generation grouping via `setGenerationParent`.
