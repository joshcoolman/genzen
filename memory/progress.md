# Genzen Progress

## Repo

`/Users/joshcoolman/repos/genzen` — TanStack Start, Supabase, FAL AI, Vercel AI SDK, Tailwind v4, shadcn/ui

---

## Active Branch: `gen-video`

### Recently committed

- **Upload mode for FLF frames** (`gen-video` branch): FLUX Kontext Pro (first frame) and Image toggle (last frame) let users supply their own images instead of AI-generating. Client-side `cropTo16x9` crops to 1280×720 JPEG via canvas. New `upload-video-frame.server.ts` uploads directly to Supabase storage and inserts a `status: 'completed'` record — no FAL queue, no polling. Preview shows immediately on pick; hover reveals "Change Image" overlay. Both paths flow into the existing Wan FLF2V pipeline unchanged.
- **AI Video feature** (`gen-video` branch): New `/dashboard/video` route implementing FLF (first-frame → last-frame → video) workflow. See Key Files below for server fn locations. Requires running the DB migration before testing.

### Previously committed (main)

- **AI SDK migration**: Replaced `@anthropic-ai/sdk` with `ai` + `@ai-sdk/anthropic`. All 4 Anthropic server functions now use `generateText()` via shared client in `src/lib/server/ai.server.ts`. FAL calls unchanged.
- **Pre-commit workflow**: Added `pnpm check -> build -> commit` to CLAUDE.md
- **ESLint/Prettier cleanup**: 70+ files auto-fixed
- **Family grouping in gallery**: images grouped by root ancestor (original + all descendants)
- **Removed family grouping**: replaced nested group grid with flat chronological sort. Variations still appear near source via timestamp offsets.

### Key decisions made

- **AI SDK over gateway**: Evaluated Vercel AI Gateway but decided direct provider access (`@ai-sdk/anthropic`) is better — avoids middleman, preserves prompt caching option, no extra network hop. Gateway can be revisited later.
- **FAL stays for media generation**: FAL has broadest media model catalog (FLUX, Kling 3.0, video, audio). LLMs accessed directly via AI SDK provider packages.
- **TanStack Start confirmed**: Evaluated Next.js migration — not worth it. Type-safe routing, fast Vite HMR, and no vendor lock-in outweigh Next.js ecosystem size. TanStack Start deploys to Vercel if needed.
- **Model swaps are trivial now**: Adding Gemini/DeepSeek/etc is just `pnpm add @ai-sdk/google` + one line in `ai.server.ts`

---

## Known Issues / Backlog

- **Video migration**: `supabase/migrations/20260225000000_add_video_source_types.sql` must be applied before testing video locally (`supabase migration up` if Docker already running, or `supabase stop --all && supabase start`)
- **Video branch**: `gen-video` branch not yet merged to main

---

## How the "More" Feature Works (for context)

1. User hovers image → clicks "More"
2. **Client**: immediately inserts 2 optimistic placeholder cards inline (sorted by `created_at + 1s/2s`)
3. **Server** (`generate-variation.server.ts`):
   - Fetches source image `storage_path` + `generation_metadata` from Supabase
   - Resolves root prompt (traces back through variation chain to original)
   - Fetches image bytes → base64 (Claude) + uploads to FAL storage (FAL URL)
   - Queries existing variation prompts in the family for "avoid" list
   - Calls Claude Sonnet via AI SDK `generateText()` with image + avoid list
   - Submits both to `fal-ai/flux-pro/kontext` with `image_url` + `guidance_scale: 5.0`
   - Inserts 2 pending DB records with `created_at` offset from source
4. **Client**: realtime INSERT replaces optimistic placeholders; on server return, cleans up any remaining optimistic + deduplicates real cards
5. **Realtime + polling**: updates cards as FAL completes

---

## Key Files

| File                                                            | Purpose                                         |
| --------------------------------------------------------------- | ----------------------------------------------- |
| `src/lib/server/ai.server.ts`                                   | Shared AI SDK client (haiku/sonnet)             |
| `src/features/ai-images/models.ts`                              | Model list + defaults                           |
| `src/features/ai-images/server/generate-variation.server.ts`    | "More" server function                          |
| `src/features/ai-images/server/generate-image.server.ts`        | Main generation server function                 |
| `src/features/ai-images/server/check-pending-images.server.ts`  | Polling / FAL result fetcher (reused by video)  |
| `src/features/ai-images/components/PendingImageCard.tsx`        | Loading card UI                                 |
| `src/routes/dashboard/ai-images.tsx`                            | AI Images page — gallery, state, realtime       |
| `src/routes/dashboard/video.tsx`                                | AI Video page — FLF 3-step UI                   |
| `src/features/ai-video/server/generate-first-frame.server.ts`   | First frame: FLUX Kontext Pro or Kling O3       |
| `src/features/ai-video/server/generate-last-frame.server.ts`    | Last frame: Kontext Max with first frame ref    |
| `src/features/ai-video/server/generate-flf-video.server.ts`     | Video: Wan FLF2V queue submit                   |
| `src/features/ai-video/server/check-pending-video.server.ts`    | Video polling — downloads MP4, stores in bucket |
| `src/features/ai-video/server/suggest-last-frame.server.ts`     | Claude-powered last frame prompt suggestion     |
| `src/features/ai-video/server/upload-video-frame.server.ts`     | Upload image as completed frame (no FAL)        |
| `supabase/migrations/20260225000000_add_video_source_types.sql` | Adds ai_video_frame + ai_video source values    |
