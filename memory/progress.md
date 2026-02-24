# Genzen Progress

## Repo

`/Users/joshcoolman/repos/genzen` — TanStack Start, Supabase, FAL AI, Vercel AI SDK, Tailwind v4, shadcn/ui

---

## Active Branch: `main`

### Recently committed

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

No active backlog items. Stable state — issues will be added as they come up.

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

| File                                                           | Purpose                              |
| -------------------------------------------------------------- | ------------------------------------ |
| `src/lib/server/ai.server.ts`                                  | Shared AI SDK client (haiku/sonnet)  |
| `src/features/ai-images/models.ts`                             | Model list + defaults                |
| `src/features/ai-images/server/generate-variation.server.ts`   | "More" server function               |
| `src/features/ai-images/server/generate-image.server.ts`       | Main generation server function      |
| `src/features/ai-images/server/check-pending-images.server.ts` | Polling / FAL result fetcher         |
| `src/features/ai-images/components/PendingImageCard.tsx`       | Loading card UI                      |
| `src/routes/dashboard/ai-images.tsx`                           | Main page — gallery, state, realtime |
