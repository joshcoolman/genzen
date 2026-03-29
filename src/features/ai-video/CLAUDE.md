# AI Video

Workspace-based video generation using first-frame/last-frame (FLF) workflow via FAL AI.

## Key Files

- `types.ts` -- `Generation`, `FrameState`, `VideoSettings`, default prompts, frame model defs
- `video-models.ts` -- `ALL_VIDEO_MODELS` (8 models: Kling 3.0/O3/2.6/2.5-Turbo/O1, LTX-2.3, Sora 2, WAN 2.5) with capability flags
- `constants.ts` -- `FIRST_FRAME_MODEL_FOR_MODE` mapping (prompt mode vs image mode)
- `lib/crop-to-16x9.ts` -- client-side canvas crop to 1280x720 + `fileToBase64`
- `server/generate-flf-video.server.ts` -- main video gen: uploads frames to FAL, schema-driven param resolution, Kling prompt format
- `server/generate-first-frame.server.ts` -- generate first frame image from prompt or reference
- `server/generate-last-frame.server.ts` -- generate last frame (FLUX Kontext or nano-banana, optionally includes first frame context)
- `server/suggest-last-frame.server.ts` -- Claude AI suggestion for last frame prompt (with optional vision grounding)
- `server/create-generation.server.ts` -- create generation record linking frames and video
- `server/create-workspace.server.ts` -- create new workspace
- `server/delete-workspace.server.ts` -- delete workspace; intelligently cleans up non-shared image records
- `server/delete-generation.server.ts` -- delete single generation; intelligently cleans up shared images
- `server/get-generations.server.ts` -- fetch generations for a workspace with R2 public URLs
- `server/get-workspace.server.ts` -- fetch single workspace
- `server/get-workspaces.server.ts` -- list all workspaces with preview data (hero image, thumbnails, prompt)
- `server/get-video-url.server.ts` -- resolve video URL from FAL metadata
- `server/rename-workspace.server.ts` -- rename workspace
- `server/move-generations.server.ts` -- batch move generations between workspaces
- `server/update-generation.server.ts` -- link video record to generation
- `server/upload-video-frame.server.ts` -- upload user image as frame; stores cropped (1280x720) + original
- `server/fal-video-schema.server.ts` -- fetches + caches FAL video model OpenAPI schemas; auto-detects params
- `hooks/use-video-workspace-page.ts` -- master orchestrator composing all sub-hooks
- `hooks/use-first-frame-generator.ts` -- first frame generation + file upload/library selection
- `hooks/use-last-frame-generator.ts` -- last frame generation
- `hooks/use-video-generator.ts` -- video settings + generation submission
- `hooks/use-frame.ts` -- shared frame state (status, URL, polling)
- `hooks/use-generations.ts` -- workspace generation list management
- `hooks/use-generation-selection.ts` -- multi-select for batch operations
- `hooks/use-workspaces.ts` -- workspace list
- `hooks/use-active-workspace.ts` -- active workspace routing
- `hooks/use-workspace-name.ts` -- inline rename
- `hooks/use-workspace-delete.ts` -- workspace deletion with navigation
- `components/FramePanel.tsx` -- first/last frame editing panel with library/upload/paste/outpaint
- `components/FrameImageArea.tsx` -- frame image display with generate/upload controls
- `components/VideoSettingsPanel.tsx` -- model selector (8 models), transition prompt, duration, cfg_scale, negative prompt; hides unsupported options per model
- `components/GenerationRow.tsx` -- single generation with frames + video; realtime Supabase subscriptions for status
- `components/SelectionBar.tsx` -- bulk actions for selected generations (move, delete)
- `components/WorkspaceHeader.tsx` -- workspace name + rename/delete actions
- `components/WorkspaceCard.tsx` -- workspace list card with hero image and thumbnails
- `components/WorkspaceStrip.tsx` -- horizontal workspace list
- `index.ts` -- barrel export

## Route

`src/routes/dashboard/video.tsx` (layout), `video.index.tsx` (workspace list + detail via query params), `video.$workspaceId.tsx` (redirect to `video.index.tsx?workspaceId=X`)

## Shared Dependencies

- `src/lib/server/auth.server.ts` -- `requireAuth()`
- `src/features/credits/` -- credit checking and deduction (video_gen, first_frame, last_frame costs)
- `src/features/user-images/` -- `useUserImages` for image picker in frame upload
- `src/lib/server/check-pending-generations.server.ts` -- shared polling utility for FAL queue results

## Key Patterns

- **Realtime**: GenerationRow subscribes to `postgres_changes` on `user_images` for live status updates
- **Intelligent cleanup**: delete functions only remove image records not referenced by other generations
- **Schema auto-detection**: `fal-video-schema.server.ts` caches FAL OpenAPI specs and auto-detects param names, duration type, cfg_scale/negative_prompt support
- **Image URLs**: R2 public URLs via `createImageStorage()`, no signing/expiry

## Quirks / Notes

- FLF = first-last-frame: generates start + end frames as images, then creates video transitioning between them
- Kling models use special prompt format: `@Image1 {prompt} @Image2` for FLF transitions
- Only FLF-capable models (7 of 8) support last frame; Sora 2 is image-to-video only
- First frame has two modes: "prompt" (text-to-image via Kling O3) and "image" (reference image via FLUX Kontext Pro)
- Frame cropping enforces 16:9 at 1280x720
- Video supports deep-linking via `?workspaceId=X&generationId=Y`
- Orchestrator hook owns `firstFrameMode` to break circular dep between frame and generator hooks
