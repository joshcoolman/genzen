## Overview

Create multi-shot videos with consistent characters and objects across shots. Define elements (character images), compose shots with individual prompts and durations (15s total budget), and generate via Kling V3 Pro's `multi_prompt` API.

## How It Works

1. Create a sequence, add start image and character/object elements
2. Compose 1-6 shots with individual prompts and durations (15s total budget)
3. Reference elements in prompts as @Element1, @Element2, etc.
4. Generate via Kling V3 Pro `multi_prompt` API
5. After first generation, elements are locked (duplicate sequence to modify)
6. Generation history shows all attempts with video playback

## Usage

- Navigate to Multi-Shot from sidebar
- Create new sequence, add start image and elements
- Compose shots, set durations, generate
- Browse generation history for past attempts

## Key Files

- `src/features/multi-shot/types.ts` -- Shot, MultiShotElement, MultiShotSequence types; MAX_SHOTS=6, MAX_TOTAL_DURATION=15
- `src/features/multi-shot/server/generate-multishot.server.ts` -- Uploads elements to FAL, submits via multi_prompt
- `src/features/multi-shot/server/save-sequence.server.ts` -- Create/update sequence (JSONB columns)
- `src/features/multi-shot/hooks/use-multishot-editor.ts` -- Shots CRUD, elements, settings, budget calc
- `src/features/multi-shot/hooks/use-sequence-detail.ts` -- Detail page: load sequence, generation history, element locking
- `src/features/multi-shot/components/MultiShotEditor.tsx` -- Start image, elements, settings, shot cards, time budget bar
- `src/features/multi-shot/components/ShotCard.tsx` -- Per-shot prompt + duration stepper (min 3s)
- `src/features/multi-shot/components/GenerationHistory.tsx` -- Past attempts with video playback, sort/size toggles

## Dependencies

- FAL AI -- Kling V3 Pro (`fal-ai/kling-video/v3/pro/image-to-video`)
- Supabase -- sequence persistence, image storage
- `@/features/credits/` -- 5 credits per generation
- `@/features/user-images/` -- element image selection

## Database

- `multishot_sequences` -- sequence records with JSONB shots/elements/settings
- `user_images` -- generated videos (source: 'ai_video')

## Route

`/dashboard/multi-shot` (list) and `/dashboard/multi-shot/$sequenceId` (detail)
