# Continue: Multi-Shot Video Generation (Issue #72)

## What was being worked on

Full implementation of multi-shot video generation feature under `src/features/multi-shot/`. Uses Kling V3 Pro via FAL (`fal-ai/kling-video/v3/pro/image-to-video`) with `multi_prompt` API for multi-shot sequences.

## Changes made so far (ALL UNCOMMITTED on branch `multi-shot`)

- **Migration**: `supabase/migrations/20260317000000_multishot_sequences.sql` -- `multishot_sequences` table with JSONB columns for shots/elements/settings, RLS policy
- **Types**: `src/features/multi-shot/types.ts` -- Shot, MultiShotElement, MultiShotSettings, MultiShotSequence, constants (MAX_SHOTS=6, MAX_TOTAL_DURATION=15, MIN_SHOT_DURATION=3), FAL model ID
- **Credits**: Added `multishot_gen` to CreditReason union + `multishot_gen: 5` to CREDIT_COSTS in `src/features/credits/types.ts`
- **Server functions** (5 files in `src/features/multi-shot/server/`):
  - `generate-multishot.server.ts` -- loads sequence, uploads element images to FAL, submits via `multi_prompt`, creates `user_images` record with `source: 'ai_video'` for polling
  - `save-sequence.server.ts` -- upsert to `multishot_sequences` (fixed: passes raw objects to Supabase, NOT JSON.stringify)
  - `get-sequences.server.ts` -- list with `parseJsonb()` helper for defensive JSONB deserialization
  - `delete-sequence.server.ts`, `duplicate-sequence.server.ts`
- **Hooks** (2 files in `src/features/multi-shot/hooks/`):
  - `use-multishot-editor.ts` -- shots CRUD, elements CRUD (fixed: `prev.length + 1` inside updater for correct labels), settings, budget calc, generate/save
  - `use-multishot-sequences.ts` -- fetch list, poll every 5s when pending, delete/duplicate
- **Components** (6 files in `src/features/multi-shot/components/`):
  - `MultiShotEditor.tsx` -- main editor with elements section (uses ExistingImagePicker from user-images), shot cards, settings (aspect ratio, shot type, audio toggle), generate button
  - `ShotCard.tsx` -- prompt textarea + duration stepper (min 3s, capped by remaining budget)
  - `ElementCard.tsx` -- 16x16 thumbnail with @ElementN label, delete button
  - `TimeBudgetBar.tsx` -- segmented color-coded progress bar showing 15s budget
  - `SequenceGrid.tsx` / `SequenceCard.tsx` -- past sequences grid with status badges, duplicate/delete
- **Routes**: `src/routes/dashboard/multi-shot.tsx` (layout) + `multi-shot.index.tsx` (main page)
- **Nav**: Added `Clapperboard` icon Multi-Shot item after AI Video in `src/lib/nav-items.ts`
- **shadcn**: Added `src/components/ui/label.tsx` and `src/components/ui/switch.tsx`
- **Feature docs**: `src/features/multi-shot/CLAUDE.md`
- **Barrel**: `src/features/multi-shot/index.ts`

## Key decisions

- FAL model: `fal-ai/kling-video/v3/pro/image-to-video` -- same endpoint for single and multi-shot, uses `multi_prompt` param
- JSONB columns for shots/elements/settings -- avoids migration churn during V1 experimentation
- Element images uploaded to FAL on generate (not on add) -- simpler UX
- Stored as `user_images` with `source: 'ai_video'` so existing polling in `check-pending-generations.server.ts` picks up completion automatically
- Supabase JSONB: do NOT `JSON.stringify()` before insert -- Supabase client handles serialization

## Outstanding work

- **Not yet tested end-to-end**: save + generate flow needs real testing with FAL (was debugging DB issues)
- **Sequence status updates**: when polling detects completion, need to update `multishot_sequences.status` to 'completed' -- currently only `user_images` gets updated by existing polling. May need to extend `check-pending-generations.server.ts` or add a separate mechanism
- **Video playback**: completed sequences don't show the video yet -- need to resolve video URL from the `video_record_id` and display it
- **Start image**: settings support `startImageUrl` but there's no UI to set it yet
- **UI polish**: the editor is functional but basic -- no drag-to-reorder shots, no inline video preview
- **Commit**: nothing is committed yet -- all changes are uncommitted on branch `multi-shot`

## Git state

- Branch: `multi-shot`
- All changes uncommitted (3 modified + 20 untracked files)
- `pnpm build` passes, `pnpm check` passes (no new lint errors in multi-shot files)
- DB migration applied locally via `npx supabase migration up`
