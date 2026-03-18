# Multi-Shot

Multi-shot video generation using Kling V3 Pro via FAL. Users define elements (character/object images), compose 1-6 shots with per-shot prompts and durations (15s total budget), and generate a single multi-shot video.

## Architecture: List/Detail Split

- **List page** (`multi-shot.index.tsx`): Shows sequence cards with start image thumbnails. "New Sequence" creates a draft and navigates to detail.
- **Detail page** (`multi-shot.$sequenceId.tsx`): Editor + generation history. Uses `useSequenceDetail` hook.
- **Element locking**: After first generation, elements are locked (add/remove disabled). Duplicate sequence to modify.
- **Generation history**: Queries `user_images` by `generation_metadata->>'sequence_id'` -- all past attempts visible in a horizontal scroll row.

## Key Files

- `types.ts` -- Shot, MultiShotElement, MultiShotSettings, MultiShotSequence, GenerationRecord types, constants
- `index.ts` -- barrel export
- `server/generate-multishot.server.ts` -- Core generation: loads sequence, uploads elements to FAL, submits via multi_prompt
- `server/save-sequence.server.ts` -- Create/update sequence
- `server/get-sequences.server.ts` -- List user sequences
- `server/get-sequence.server.ts` -- Fetch single sequence with derived status
- `server/get-sequence-generations.server.ts` -- Query generation history for a sequence
- `server/delete-sequence.server.ts` -- Delete sequence
- `server/duplicate-sequence.server.ts` -- Copy sequence for iteration
- `hooks/use-multishot-editor.ts` -- Main editor state: shots CRUD, elements, settings, budget calc, generate/save. Supports `elementsLocked` option.
- `hooks/use-multishot-sequences.ts` -- Sequence list with polling for pending status
- `hooks/use-sequence-detail.ts` -- Detail page hook: loads sequence, manages generation history, polls pending, computes element lock state
- `components/MultiShotEditor.tsx` -- Main editor: elements section, shot cards, settings, generate button. Accepts `elementsLocked` prop.
- `components/ShotCard.tsx` -- Single shot: prompt textarea, duration stepper
- `components/ElementCard.tsx` -- Element thumbnail with label and delete. Accepts `locked` prop.
- `components/TimeBudgetBar.tsx` -- Segmented progress bar showing 15s budget
- `components/SequenceGrid.tsx` -- Grid of sequence cards, `onNavigate` callback
- `components/SequenceCard.tsx` -- Sequence card with start image thumbnail, status badge, navigate on click
- `components/GenerationHistory.tsx` -- Horizontal scroll row of generation attempt cards with video playback

## Routes

- `src/routes/dashboard/multi-shot.tsx` -- layout (Outlet)
- `multi-shot.index.tsx` -- list page
- `multi-shot.$sequenceId.tsx` -- detail/editor page

## Shared Dependencies

- `src/lib/server/auth.server.ts` -- `requireAuth()`
- `src/features/credits/` -- credit checking and deduction (multishot_gen = 5 credits)
- `src/features/user-images/` -- ExistingImagePicker for element selection
- `src/lib/server/check-pending-generations.server.ts` -- existing polling picks up multishot videos automatically

## FAL API

Model: `fal-ai/kling-video/v3/pro/image-to-video`
Key params: `multi_prompt` (array of {prompt, duration}), `elements` (array of {frontal_image_url, label}), `shot_type`, `generate_audio`, `start_image_url`

## Quirks / Notes

- Uses `multi_prompt` instead of single `prompt` for multi-shot generation
- Elements are referenced in shot prompts as @Element1, @Element2, etc.
- Element images uploaded to FAL on generate, not on add (simpler UX)
- Stored as `user_images` with `source: 'ai_video'` so existing polling picks up completion
- Sequences stored in `multishot_sequences` table with JSONB columns for shots/elements/settings
- Total duration budget: 15 seconds across all shots, minimum 3s per shot
- Future: reusable element library with naming (#79)
