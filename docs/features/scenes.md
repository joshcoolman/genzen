## Overview

Upload a source image, generate 9 distinct camera angle prompts via Claude vision, then generate images for each. Two-step workflow: prompts first, then images. Each cell has its own editable prompt and can be regenerated independently.

## How It Works

1. Upload or select source image (or paste from clipboard)
2. "Generate Prompts" -- Claude vision generates 9 camera angle prompts
3. Edit individual prompts in per-cell textareas
4. "Generate Images" -- all non-empty cells generate in parallel
5. Per-cell wand icon regenerates a single prompt; refresh icon regenerates a single image
6. Slideshow arrows browse prior generations per cell

## Usage

- Navigate to Scenes from sidebar
- Upload source image, generate prompts, then generate images
- Edit individual prompts, regenerate single cells as needed

## Key Files

- `src/features/scenes/constants.ts` -- SCENE_CELL_COUNT (9), DEFAULT_SCENE_MODEL_ID, SCENE_SYSTEM_PROMPT
- `src/features/scenes/hooks/use-scenes.ts` -- Master hook (~750 lines): per-cell prompts, generation, polling, realtime, lightbox
- `src/features/scenes/server/generate-scene-prompts.server.ts` -- Claude vision generates 9 camera angle prompts (free, no credits)
- `src/features/scenes/components/ScenesPage.tsx` -- TwoColumnLayout + Lightbox + clipboard paste
- `src/features/scenes/components/ScenesGrid.tsx` -- 3x3 grid of SceneCell
- `src/features/scenes/components/ScenesPanel.tsx` -- Left panel: source image, model picker, aspect ratio, generate buttons
- `src/features/scenes/components/SceneCell.tsx` -- Per-cell prompt textarea, image preview with slideshow nav, regen buttons

## Dependencies

- Claude Sonnet (via Vercel AI SDK) -- prompt generation (vision, free)
- FAL AI -- image generation (default: Nano Banana 2)
- Supabase -- realtime, image storage
- `@/features/credits/` -- image generation costs credits

## Route

`/dashboard/scenes`
