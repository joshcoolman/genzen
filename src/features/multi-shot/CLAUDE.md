# Multi-Shot

Multi-shot video generation using Kling V3 Pro via FAL. Users define elements (character/object images), compose 1-6 shots with per-shot prompts and durations (15s total budget), and generate a single multi-shot video.

## Architecture: List/Detail Split

- **List page** (`multi-shot.index.tsx`): Shows sequence cards with start image thumbnails. "New Sequence" creates a draft and navigates to detail.
- **Detail page** (`multi-shot.$sequenceId.tsx`): Editor + generation history. Uses `useSequenceDetail` hook. "New Sequence" creates a DB record and navigates to the returned ID.
- **Element locking**: After first generation, elements are locked (add/remove disabled). Lock state computed as `generations.length > 0`. Duplicate sequence to modify.
- **Generation history**: Queries `user_images` by `generation_metadata->>'sequence_id'` -- all past attempts visible in a grid with customizable size, sort order, and info display.

## Key Files

- `types.ts` -- Shot, MultiShotElement, MultiShotSettings, MultiShotSequence, GenerationRecord types; constants (MAX_SHOTS=6, MAX_TOTAL_DURATION=15, MIN_SHOT_DURATION=3)
- `index.ts` -- barrel export
- `persona.md` -- creative director guidance for multi-shot prompting, camera language, pacing, composition
- `server/generate-multishot.server.ts` -- Core generation: loads sequence, uploads elements to FAL, submits via multi_prompt
- `server/save-sequence.server.ts` -- Create/update sequence (JSONB columns: shots, elements, settings)
- `server/get-sequences.server.ts` -- List user sequences with derived status and re-signed URLs
- `server/get-sequence.server.ts` -- Fetch single sequence with derived status and re-signed URLs
- `server/get-sequence-generations.server.ts` -- Query generation history for a sequence
- `server/delete-sequence.server.ts` -- Hard delete sequence
- `server/duplicate-sequence.server.ts` -- Copy sequence with "(copy)" appended
- `server/delete-generation.server.ts` -- Soft-delete individual generation records (sets deleted_at)
- `hooks/use-multishot-editor.ts` -- Main editor state: shots CRUD, elements, settings, budget calc, estimated cost. Supports `elementsLocked` option.
- `hooks/use-multishot-sequences.ts` -- Sequence list with polling for pending status (every 5s)
- `hooks/use-sequence-detail.ts` -- Detail page hook: loads sequence, manages generation history, computes element lock state
- `components/MultiShotEditor.tsx` -- Main editor: start image picker (with QuickOutpaintDialog), elements (RefImageStrip), settings, shot cards, time budget bar; accepts `originalUrls` to resolve full-res URLs for generation
- `components/ShotCard.tsx` -- Single shot: prompt textarea, duration stepper (min 3s)
- `components/ElementCard.tsx` -- Element thumbnail with label and delete. Accepts `locked` prop
- `components/TimeBudgetBar.tsx` -- Segmented progress bar showing 15s budget with estimated cost
- `components/SequenceGrid.tsx` -- Grid of sequence cards, `onNavigate` callback
- `components/SequenceCard.tsx` -- Sequence card with start image thumbnail, status badge, navigate on click
- `components/GenerationHistory.tsx` -- Grid of generation attempts with video playback, thumbnail size/sort/info toggles (prefs in localStorage)

## Routes

- `src/routes/dashboard/multi-shot.tsx` -- layout (Outlet)
- `multi-shot.index.tsx` -- list page
- `multi-shot.$sequenceId.tsx` -- detail/editor page

## Shared Dependencies

- `src/lib/server/auth.server.ts` -- `requireAuth()`
- `src/features/credits/` -- credit checking and deduction (multishot_gen = 5 credits)
- `src/features/user-images/` -- ExistingImagePicker, RefImageStrip for element selection
- `src/lib/server/check-pending-generations.server.ts` -- existing polling picks up multishot videos automatically

## FAL API

Model: `fal-ai/kling-video/v3/pro/image-to-video`
Key params: `multi_prompt` (array of {prompt, duration}), `elements` (array of {frontal_image_url, reference_image_urls, label}), `shot_type`, `generate_audio`, `start_image_url`

## Quirks / Notes

- Uses `multi_prompt` instead of single `prompt` for multi-shot generation
- Elements are referenced in shot prompts as @Element1, @Element2, etc.
- Element images uploaded to FAL on generate, not on add (simpler UX)
- Stored as `user_images` with `source: 'ai_video'` so existing polling picks up completion
- Sequences stored in `multishot_sequences` table with JSONB columns for shots/elements/settings
- Total duration budget: 15 seconds across all shots, minimum 3s per shot
- Dual pricing: 0.168 credits/s with audio, 0.14 credits/s without
- Element/start image URLs resolved via R2 public URLs on each fetch; picker uses full-res original URLs (not thumbnails) for FAL generation
- GenerationHistory preferences (sort, info, thumbSize) persisted in localStorage
- Future: reusable element library with naming (#79)
