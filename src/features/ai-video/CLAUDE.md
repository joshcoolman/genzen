# AI Video

Workspace-based video generation using first-frame/last-frame (FLF) workflow via FAL AI.

## Key Files

- `types.ts` -- `Generation`, `FrameState`, `VideoSettings`, default prompts, frame model defs
- `video-models.ts` -- `ALL_VIDEO_MODELS` with capability flags (FLF, I2V, durations, cfg_scale, negative_prompt)
- `constants.ts` -- `FIRST_FRAME_MODEL_FOR_MODE` mapping (prompt mode vs image mode)
- `lib/crop-to-16x9.ts` -- client-side canvas crop + `fileToBase64`
- `server/generate-flf-video.server.ts` -- main video gen: uploads frames to FAL, schema-driven param resolution
- `server/generate-first-frame.server.ts` -- generate first frame image from prompt or reference
- `server/generate-last-frame.server.ts` -- generate last frame (uses nano-banana or Claude suggestion)
- `server/suggest-last-frame.server.ts` -- AI suggestion for last frame prompt
- `server/create-generation.server.ts` -- create generation record in DB
- `server/create-workspace.server.ts` -- create new workspace
- `server/delete-workspace.server.ts` -- delete workspace and its generations
- `server/delete-generation.server.ts` -- delete single generation
- `server/get-generations.server.ts` -- fetch generations for a workspace
- `server/get-workspace.server.ts` -- fetch single workspace
- `server/get-workspaces.server.ts` -- list all workspaces
- `server/get-video-url.server.ts` -- resolve video URL from storage
- `server/rename-workspace.server.ts` -- rename workspace
- `server/move-generations.server.ts` -- move generations between workspaces
- `server/update-generation.server.ts` -- update generation record
- `server/upload-video-frame.server.ts` -- upload user image as frame
- `server/fal-video-schema.server.ts` -- fetches + caches FAL video model schemas
- `hooks/use-video-workspace-page.ts` -- master orchestrator composing all sub-hooks
- `hooks/use-first-frame-generator.ts` -- first frame generation + mode switching
- `hooks/use-last-frame-generator.ts` -- last frame generation
- `hooks/use-video-generator.ts` -- video settings + generation submission
- `hooks/use-frame.ts` -- shared frame state (status, URL, polling)
- `hooks/use-generations.ts` -- workspace generation list management
- `hooks/use-generation-selection.ts` -- multi-select for batch operations
- `hooks/use-workspaces.ts` -- workspace list
- `hooks/use-active-workspace.ts` -- active workspace routing
- `hooks/use-workspace-name.ts` -- inline rename
- `hooks/use-workspace-delete.ts` -- workspace deletion with navigation
- `components/FramePanel.tsx` -- first/last frame editing panel
- `components/FrameImageArea.tsx` -- frame image display with upload/generate
- `components/VideoSettingsPanel.tsx` -- video model, duration, cfg, negative prompt
- `components/GenerationRow.tsx` -- single generation with frames + video
- `components/SelectionBar.tsx` -- bulk actions for selected generations
- `components/WorkspaceHeader.tsx` -- workspace name + actions
- `components/WorkspaceCard.tsx` -- workspace list card
- `components/WorkspaceStrip.tsx` -- horizontal workspace list
- `index.ts` -- barrel export

## Route

`src/routes/dashboard/video.tsx` (layout), `video.index.tsx` (workspace list + detail via query params), `video.$workspaceId.tsx` (redirect-only, forwards to `video.index.tsx?workspaceId=X`)

## Shared Dependencies

- `src/lib/server/auth.server.ts` -- `requireAuth()`
- `src/features/credits/` -- credit checking and deduction
- `src/features/user-images/` -- `useUserImages` for image picker in frame upload
- `src/lib/server/check-pending-generations.server.ts` -- shared polling utility for FAL queue results

## Quirks / Notes

- FLF = first-last-frame: generates start + end frames as images, then creates a video transitioning between them
- Kling models use special prompt format: `@Image1 {prompt} @Image2` for FLF transitions
- `fal-video-schema.server.ts` is separate from the image schema fetcher -- video models have different param shapes (imageParam, endImageParam, durationIsInteger)
- First frame has two modes: "prompt" (text-to-image via Kling O3) and "image" (reference image via FLUX Kontext Pro)
- Video supports deep-linking to a specific generation via `$workspaceId?gen=xxx`
- Orchestrator hook (`use-video-workspace-page`) owns `firstFrameMode` to break circular dep between frame and generator hooks
