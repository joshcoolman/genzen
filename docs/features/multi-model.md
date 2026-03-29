## Overview

Run the same prompt (with optional source image) across 9 different AI models and compare results side by side. Each cell can be toggled on/off and has its own model picker. Supports batch and per-cell generation with generation history slideshow.

## How It Works

1. User enters a prompt and optional source image
2. "Generate All" runs enabled cells in parallel via FAL queue
3. Polling at 5s intervals + Supabase realtime for completion
4. Generated images grouped under a parent in AI Images gallery
5. State persisted to localStorage (prompts, cells, model selections)

## Usage

- Navigate to Dev Workspace > Multi-Model
- Enter a prompt, optionally attach a source image
- Toggle models on/off, customize per-cell model selection
- Generate all or regenerate individual cells

## Key Files

- `src/features/multi-model/types.ts` -- ModelCellState, MultiModelState interfaces
- `src/features/multi-model/constants.ts` -- DEFAULT_COMPARE_MODEL_IDS (9 models)
- `src/features/multi-model/hooks/use-multi-model.ts` -- Master hook (~705 lines): cell persistence, generation, polling, realtime, lightbox
- `src/features/multi-model/components/MultiModelPage.tsx` -- Page layout with clipboard paste, TwoColumnLayout, Lightbox
- `src/features/multi-model/components/MultiModelGrid.tsx` -- 3x3 grid of ModelShotCell
- `src/features/multi-model/components/MultiModelPanel.tsx` -- Left sidebar: prompts, aspect ratio, source image, generate all
- `src/features/multi-model/components/ModelShotCell.tsx` -- Single cell: preview, model picker, enable toggle, re-run

## Dependencies

- FAL AI -- image generation
- Supabase -- realtime subscriptions, image storage
- `@/features/credits/` -- credit checking and deduction
- `@/features/ai-images/` -- model registry, generation server functions

## Route

`/dashboard/dev-workspace/multi-model`
