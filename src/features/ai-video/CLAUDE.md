# AI Video

Video generation aligned with the AI Images model. A video is a single
`user_images` row with `source='ai_video'` and a generation snapshot in
`generation_metadata`. FLF and multi-shot are just different `method`
values inside the snapshot, not separate feature worlds.

## Data Model

Videos live in `user_images` alongside images. Identity is the row id;
grouping is `generation_metadata.parent_id` (mutable, mirrors ai-images);
the method + inputs that produced the video live in the rest of the
metadata blob:

```
generation_metadata = {
  method: 'flf' | 'multishot',
  parent_id?: string,
  fal_url?: string,
  // flf fields
  transition_prompt?, first_frame_url?, last_frame_url?, duration?, cfg_scale?, ...
  // multishot fields
  shots?, elements?, start_image_url?, aspect_ratio?, shot_type?, generate_audio?, ...
  // thumbnail metadata
  thumbnail_updated_at?: number,  // cache-bust stamp
  thumbnail_cleared?: boolean,    // user explicitly removed thumb
}
```

Thumbnails are stored at `thumbnail_path` (R2 key). The gallery prefers
the stored thumb and falls back to `start_image_url` / `first_frame_url`.

## Key Files

- `video-types.ts` -- `SavedAiVideo`, `VideoMethod`, `VideoShot`, `VideoElement`, `FlfSnapshot`, `MultishotSnapshot`, `VideoGenerationMetadata`, `getVideoMethod()`
- `types.ts` -- residual FLF frame-picker types still used by `VideoGeneratorPanel` + `FrameImageArea`: `FrameStatus`, `FrameMode`, `FIRST_FRAME_MODELS`, `FLUX_KONTEXT_MODEL_ID`
- `video-models.ts` -- `ALL_VIDEO_MODELS` (Kling 3.0/O3/2.6/2.5-Turbo/O1, LTX-2.3, Sora 2, WAN 2.5) with capability flags
- `constants.ts` -- `FIRST_FRAME_MODEL_FOR_MODE` mapping (prompt vs image mode)
- `lib/crop-to-16x9.ts` -- client canvas crop + `fileToBase64`
- `index.ts` -- barrel exports

## Server

- `generate-video.server.ts` -- unified FLF + multishot entry. Takes a discriminated `method` union, handles credits + rate limiting, submits to FAL, persists the snapshot + optional `parent_id`
- `group-videos.server.ts` -- set `parent_id` on many children under a primary (mirror of `group-images.server.ts`)
- `ungroup-videos.server.ts` -- clear `parent_id` on all children of a parent
- `reparent-video.server.ts` -- adopt or detach a single video (`action: 'adopt' | 'detach'`)
- `extract-video-thumbnail.server.ts` -- auto middle-frame extraction via `fal-ai/ffmpeg-api/extract-frame`, upload to R2 under `{user_id}/video-thumbnails/{video_id}.jpg`, stamp `thumbnail_updated_at`. Silent no-op on failure; the gallery falls back to the source frame
- `upload-video-thumbnail.server.ts` -- user-picked frame (base64 data URL from canvas capture). Clears `thumbnail_cleared`, stamps `thumbnail_updated_at`
- `upload-video-frame.server.ts` -- upload a user image as an FLF first/last frame, stores cropped (1280x720) + original
- `fal-video-schema.server.ts` -- cached FAL OpenAPI schemas for video models; auto-detects param names, duration type, cfg/negative prompt support

## Hooks

- `use-videos.ts` -- gallery fetch (direct Supabase), parent-bubble sort, realtime `user_images` subscription, polling for pending gens when webhooks are off, auto middle-frame extraction for completed videos without a thumbnail, `captureFrame` / `removeThumbnail` / `deleteVideo` / optimistic cards / `ungroupChildren` / `refresh`
- `use-video-sidebar.ts` -- single-mode state machine (`mode: 'flf' | 'multishot'`), `loadFromVideo()` rehydrates from a snapshot, mode toggle with field mapping, `clearPrompts()`, `generate()` dispatches to `generate-video.server.ts` with optional `sessionParentId`
- `use-reparent-video.ts` -- thin video version of the ai-images reparent hook: `startAdopt` / `startAdoptBatch` / `cancelAdopt` / `confirmAdopt` / `detach`

## Components

- `VideoGeneratorPanel.tsx` -- the sidebar. Mode toggle, FLF frame area (via `FrameImageArea`), multishot shot list + elements, aspect ratio, model select, duration, negative prompt, generate button. Used on both the main page and the edit route
- `VideoGallery.tsx` -- parent-anchor grid on the main view. `scopedIds` prop flips it into flat mode for the edit view (every scoped video rendered as an equal-sized card)
- `VideoCard.tsx` -- mirrors `ImageCard` overlay layout: More menu top-left, Delete top-right, Select circle bottom-left, Play bottom-right, `alwaysShowOverlay`. Menu: Generate Thumb / Remove Thumb / Download / Move / Ungroup / Unlink / Delete
- `VideoParentPickerDialog.tsx` -- picker for the Move action, thin video copy of `ParentPickerDialog.tsx`
- `VideoFramePickerDialog.tsx` -- scrub-only video picker for user-picked thumbnails. Routes the video through `/api/video-proxy?url=...` so `canvas.toDataURL()` works across CDN CORS
- `FrameImageArea.tsx` -- FLF first/last frame slot (generate / upload / library / paste)

## Routes

- `src/routes/dashboard/video.index.tsx` -- main gallery + pinnable `VideoGeneratorPanel` sidebar. SelectionDrawer bulk actions: Group (2+), Ungroup (when a selected video is a parent), Move, Delete
- `src/routes/dashboard/video.edit.$videoId.tsx` -- scoped group view. Pre-populates the sidebar from the video's snapshot, locks a `sessionParentId` on entry (X's parent or X itself) so every gen in the session joins the same group regardless of which thumb is highlighted
- `server/api/video-proxy.get.ts` -- CORS-enabled streaming proxy for FAL video URLs (allowlisted hosts), forwards Range headers for scrubbing

## Shared Dependencies

- `src/lib/server/auth.server.ts` -- `requireAuth()`
- `src/lib/image-storage.ts` -- `createImageStorage()`, `getR2PublicUrl()`
- `src/lib/server/check-pending-generations.server.ts` -- shared polling for FAL queue results when webhooks are off
- `src/features/credits/` -- credit check + deduction (`video_gen` cost)
- `src/features/user-images/` -- `useUserImages` for image picker in frame / start image flows

## Quirks / Notes

- Videos and images share the `user_images` table and `source` column discriminates; never forget the `.eq('source', 'ai_video')` filter in video queries
- Kling `@Image1`/`@Image2` prompt syntax references the `elements` array -- don't use it for FLF (which uses `start_image_url` / `end_image_url`)
- Only FLF-capable models support the last frame; Sora 2 and WAN 2.5 are image-to-video only
- Thumbnail cache-busting: the R2 URL includes a `?v={thumbnail_updated_at}` query so picking a new frame actually reloads (same storage path would otherwise serve stale bytes)
- `thumbnail_cleared: true` in metadata tells the auto-extractor to leave the row alone (user explicitly removed the thumb)
- The old workspace model (`video_workspaces`, `video_generations`, workspace strip) was deleted in Phase 5. Any reference to "workspace" in tool output is stale
