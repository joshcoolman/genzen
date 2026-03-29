## Overview

Generate videos by defining start and end frame images, then creating a video that transitions between them. Supports 8 video models (Kling 3.0, Sora 2, LTX, WAN, etc.). Organized into workspaces for project-based workflows.

## How It Works

1. User creates a workspace, then generates or uploads first/last frame images
2. First frame has two modes: "prompt" (text-to-image via Kling O3) or "image" (reference via FLUX Kontext Pro)
3. Video model selected, transition prompt entered, video generated via FAL queue
4. Kling models use special FLF prompt format: `@Image1 {prompt} @Image2`
5. GenerationRow subscribes to Supabase realtime for live status updates
6. Frame cropping enforces 16:9 at 1280x720

## Usage

- Navigate to AI Video, create a workspace
- Generate or upload first frame, optionally last frame
- Select video model, enter transition prompt, generate
- Results appear in generation list with realtime status updates

## Key Files

- `src/features/ai-video/types.ts` -- Generation, FrameState, VideoSettings types
- `src/features/ai-video/video-models.ts` -- 8 video models with capability flags (FLF support, duration, cfg_scale)
- `src/features/ai-video/server/generate-flf-video.server.ts` -- Main video generation: uploads frames to FAL, schema-driven param resolution
- `src/features/ai-video/server/generate-first-frame.server.ts` -- First frame from prompt or reference
- `src/features/ai-video/server/generate-last-frame.server.ts` -- Last frame via FLUX Kontext or nano-banana
- `src/features/ai-video/server/suggest-last-frame.server.ts` -- Claude AI suggestion for last frame prompt
- `src/features/ai-video/server/create-workspace.server.ts` -- Workspace CRUD
- `src/features/ai-video/hooks/use-video-workspace-page.ts` -- Master orchestrator composing all sub-hooks
- `src/features/ai-video/components/FramePanel.tsx` -- Frame editing with library/upload/paste/outpaint
- `src/features/ai-video/components/VideoSettingsPanel.tsx` -- Model selector, transition prompt, duration
- `src/features/ai-video/components/GenerationRow.tsx` -- Generation display with realtime Supabase subscriptions

## Dependencies

- FAL AI -- video model inference (Kling, LTX, Sora, WAN)
- Supabase -- workspace/generation persistence, realtime subscriptions, image storage
- `@/features/credits/` -- credit deduction (5 credits per video)
- `@/features/user-images/` -- image picker for frame upload

## Configuration

- FAL API key (server-side)
- Supabase connection for persistence and realtime

## Database

- `video_workspaces` -- workspace records
- `video_generations` -- generation records linking frames and video
- `user_images` -- frame and video image storage
