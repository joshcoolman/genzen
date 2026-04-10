# Continue: AI Video UI Convergence -- Phase 4 Complete

## What was worked on

AI Video UI convergence with AI Images patterns. 4-phase initiative. All phases done.

## Phase 1 (DONE -- commit `9b81692`)

- Pinnable right sidebar (`w-80`), shared `ModelSelector`, shared `ImageSourceDialog`

## Phase 2 (DONE -- commit `d42390e`)

Gallery grid with first-frame-as-parent model, replacing flat `GenerationRow` list.

## Phase 3 (DONE -- commit `3ccfa3c`)

Merged "AI Video" + "Multi-Shot" into single nav item with tabbed UI (`?mode=flf` / `?mode=multishot`).

## Phase 4 (DONE -- this session)

Mode-aware sidebar + unified gallery. Multi-shot controls inline in sidebar, sequence concept eliminated.

### Changes:

- **`src/features/ai-video/components/VideoGeneratorPanel.tsx`** -- Added `mode` prop (`flf` | `multishot`). FLF mode shows all existing controls. Multi-shot mode shows: start image picker, elements strip (RefImageStrip), inline shot list (ShotCard), multi-shot settings (aspect ratio, shot type, generate audio), time budget bar. Hides model selector, last frame, transition prompt, duration, CFG, negative prompt.
- **`src/routes/dashboard/video.index.tsx`** -- Removed `MultiShotListContent` component and sequence grid. Both modes now use the same sidebar + gallery layout. Instantiates `useMultishotEditor` for multi-shot state. Element picker dialog (`ExistingImagePicker`) wired for multi-shot elements. Start image synced through first frame picker. Generate button calls `multishotEditor.handleGenerate` in multi-shot mode.
- **`src/features/ai-video/components/VideoGallery.tsx`** -- Now accepts optional `multishotVideos` prop. Merges FLF groups and multishot standalone cards into one date-sorted grid.
- **`src/features/ai-video/components/MultishotVideoCard.tsx`** -- New component. Standalone card for multishot videos using `Thumbnail` + `VideoPlayerDialog`. Shows "Multi-Shot" badge, start image thumbnail, shot count, duration.
- **`src/features/ai-video/server/get-multishot-videos.server.ts`** -- New server function. Queries `user_images` where `source=ai_video` and `type=multishot`, returns start image URL, video URL, status, metadata.
- **`src/features/ai-video/hooks/use-generations.ts`** -- Added multishot video fetching + polling alongside existing FLF generation management.
- **`src/features/multi-shot/server/generate-multishot.server.ts`** -- Added `start_image_url` to generation_metadata for gallery thumbnails.
- **`src/routes/dashboard/multi-shot.$sequenceId.tsx`** -- Replaced detail page with redirect to `/dashboard/video?mode=multishot`.

### Key decisions:

- **No server refactor needed** -- `useMultishotEditor.handleGenerate` already auto-saves a sequence then generates. Sequence management is now transparent (no user-facing UI).
- **Standalone gallery cards** -- Multishot videos appear as standalone cards (not grouped by first frame). "Multi-Shot" badge distinguishes them from FLF groups.
- **Shared first frame picker** -- Start image in multi-shot mode reuses the same `ImageSourceDialog` as first frame in FLF mode.
- **Element picker at page level** -- `ExistingImagePicker` dialog lives in `video.index.tsx`, triggered by `onOpenElementPicker` callback from `VideoGeneratorPanel`.

## Git state

- Branch: `feature/video-ui-convergence`
- Clean working tree (not yet committed)
