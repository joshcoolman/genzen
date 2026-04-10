# Continue: AI Video UI Convergence -- Phase 2

## What was worked on

Unifying AI Video and Multi-Shot UX with AI Images conventions. This is a 4-phase initiative with a plan at `.claude/plans/wild-nibbling-moonbeam.md`.

## Phase 1 (DONE, committed)

- Replaced AI Video's static `w-72` sidebar with pinnable `w-80` right sidebar matching AI Images (pin/unpin, mobile dialog fallback, localStorage persistence via `genzen:video-panel-open` / `genzen:video-panel-pinned`)
- Created `src/features/ai-video/components/VideoGeneratorPanel.tsx` -- combined panel with first/last frame pickers + video settings in one sidebar component
- Moved first/last frame panels from main content 2-column grid into the sidebar (stacked vertically)
- Replaced inline video model pill buttons with shared `ModelSelector` dropdown (`display="dropdown"`, `mode="single"`)
  - Added `'video'` to `ModelCapability` in `src/components/ModelSelector/types.ts`
  - Registered `UNIFIED_VIDEO_MODELS` in `src/components/ModelSelector/models.ts`
  - Sync effect in `video.index.tsx` keeps `videoModelSelector.selectedIds[0]` in sync with `videoSettings.videoModel`
- Created `src/components/ImageSourceDialog/` -- shared reusable popup for image selection
  - Uses `createPortal` (not Radix Dialog) to avoid event trapping issues
  - Library grid with source filters (All/Uploads/AI Generated)
  - Upload button in header -- uploads to library, stays open, grid refreshes
  - Paste detection via `window.addEventListener('paste', ..., true)` (capture phase) -- pastes to library without dismissing
  - Selection is explicit thumbnail click only (upload/paste don't auto-select)
  - URL resolution: `originalUrls?.[id] ?? imageUrls[id]` (per-key fallback, not whole-object)
- Frame placeholders use muted text ("Click to choose first frame") with cursor-pointer, no button treatment
- `FrameImageArea.tsx` hover overlay shows muted "Change Image" text instead of Button

## Key decisions

- AI Images is the gold standard -- all features converge to its sidebar/gallery pattern
- Conventions first, then merge nav: Phase 1 sidebar, Phase 2 gallery grid, Phase 3 merge nav items, Phase 4 multi-shot sidebar
- Frames go in sidebar (not main content) -- user confirmed this
- ImageSourceDialog is dual-purpose: browse/select AND add to library -- upload/paste add without assuming selection intent
- `onUploadToLibrary` callback uses `page.userImages.create({ file, title: file.name })` which writes to Supabase `user_images` table, visible everywhere

## Phase 2 (NEXT -- Video Gallery Grid)

Replace horizontal `GenerationRow` list with thumbnail grid matching AI Images' `ImageGallery`:
- New `src/features/ai-video/components/VideoGallery.tsx` -- grid using `ImageGrid` with video-specific cards
- New `src/features/ai-video/components/VideoCard.tsx` -- wraps `Thumbnail` with play button overlay, status badge, model label
- Gallery toolbar: thumb size toggle (lg/md/sm), sort toggle, info toggle, localStorage prefs `genzen:video-prefs`
- Card actions: play video, load frames, continue, generate video, delete
- Move realtime Supabase subscriptions from `GenerationRow` into `use-generations.ts` hook
- Port `SelectionBar` to work with grid cards

## Phases 3-4 (future)

- Phase 3: Merge "AI Video" + "Multi-Shot" nav items into one with tabs (`?mode=flf` / `?mode=multishot`)
- Phase 4: Flip Multi-Shot controls to right sidebar, extract shared `SidebarPanel` component

## Git state

- Branch: `feature/video-ui-convergence`
- All changes committed and pushed: `9b81692 feat: AI Video pinnable sidebar + shared ImageSourceDialog`
- Clean working tree
