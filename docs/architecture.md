# Genzen — Architecture Reference

Backlog and task tracking live in GitHub Issues + Project board.
Use `gh issue list` and `gh project` commands to check status.

---

## Key Decisions

- **AI SDK over gateway**: Direct provider access (`@ai-sdk/anthropic`) — no middleman, preserves prompt caching, no extra hop
- **FAL for media generation**: Broadest model catalog (FLUX, Kling, video). LLMs via AI SDK provider packages
- **TanStack Start confirmed**: Type-safe routing, fast Vite HMR, no vendor lock-in. Deploys to Vercel if needed
- **Model swaps are trivial**: Adding providers = `pnpm add @ai-sdk/google` + one line in `ai.server.ts`

---

## How Features Work

### AI Images — "More" (variations)

1. Hover image, click "More" — client inserts 2 optimistic placeholders
2. Server: fetches source image, resolves root prompt, builds "avoid" list from existing variations
3. Claude Sonnet generates 2 variation prompts via AI SDK `generateText()`
4. Submits both to `fal-ai/flux-pro/kontext` with `image_url` + `guidance_scale: 5.0`
5. Realtime INSERT replaces placeholders as FAL completes

### AI Video — FLF Workflow

3-step: first frame (FLUX Kontext Pro) → last frame (Kontext Max) → video (Kling O1)

- Users can upload their own frames instead of AI-generating
- Video stored as FAL CDN URL directly (no re-upload to Supabase)
- Workspaces + generations tables for persistence

### Account Status / Waitlist

- `user_profiles` table with `account_status` enum (active/waitlist)
- Auto-created on signup via DB trigger
- Dashboard `beforeLoad` fetches status, provides via `AccountStatusContext`
- Nav items filtered: waitlist users see Home + Profile only
- RLS prevents users from self-updating `account_status`

---

## Key Files

| File                                                           | Purpose                                    |
| -------------------------------------------------------------- | ------------------------------------------ |
| `src/lib/server/ai.server.ts`                                  | Shared AI SDK client (haiku/sonnet)        |
| `src/lib/account-status.tsx`                                   | AccountStatus context + provider           |
| `src/lib/nav-items.ts`                                         | Centralized nav items with activeOnly flag |
| `src/features/ai-images/models.ts`                             | Model list + defaults                      |
| `src/features/ai-images/server/generate-image.server.ts`       | Main image generation                      |
| `src/features/ai-images/server/generate-variation.server.ts`   | "More" variations                          |
| `src/features/ai-images/server/check-pending-images.server.ts` | FAL polling (reused by video)              |
| `src/routes/dashboard/ai-images.tsx`                           | AI Images page                             |
| `src/routes/dashboard/video.tsx`                               | AI Video page — FLF UI                     |
| `src/features/ai-video/server/generate-first-frame.server.ts`  | First frame gen                            |
| `src/features/ai-video/server/generate-last-frame.server.ts`   | Last frame gen                             |
| `src/features/ai-video/server/generate-flf-video.server.ts`    | Video gen (Kling O1)                       |
| `supabase/migrations/`                                         | All DB migrations (timestamp-prefixed)     |
