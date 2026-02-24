# Genzen Progress

## Repo
`/Users/joshcoolman/repos/genzen` — TanStack Start, Supabase, FAL AI, Tailwind v4, shadcn/ui

---

## Active Branch: `more-refactor`

### What's on this branch (committed)
- **FLUX Kontext Pro** added to default visible models, description → "Subject-consistent generation"
- **Variations use Kontext** (`fal-ai/flux-pro/kontext`) with source image as visual anchor
- **Vision grounding**: source image fetched as bytes server-side
  - Base64 → Claude (works with local http:// Supabase URLs)
  - Uploaded to FAL storage → HTTPS URL → Kontext `image_url`
  - Magic byte detection for media type (don't trust Content-Type header)
- **Claude model**: Haiku → Sonnet 4.6 for variation prompt generation
- **Bolder system prompt**: encourages new scene/context/story beat, not just camera angle change
- **Optimistic inline UI**: 2 placeholder cards appear immediately on "More" click, sorted next to source by timestamp offset
- **Realtime INSERT** now sorts by `created_at` instead of prepending (fixes cards appearing at top)
- **"More" button**: disabled/loading state during server call

### Fixed this session (not yet committed)
- **Realtime race condition**: When a variation DB record arrived via realtime before `generateVariation` returned, a 3rd card was added instead of filling a placeholder. Fix: realtime INSERT handler now detects `generation_type === 'variation'` and replaces an optimistic placeholder in-place. Also, the `handleMoreLikeThis` replacement filters out real IDs already in state before re-adding them.

---

## Known Issues / Backlog

### High priority
- [ ] Variation card labeling — cards derived from an original show same model name + date as source, no indication they're variants. Need a visual treatment (label? subtle border? indicator?). Josh is still thinking about the right approach.

### Medium priority
- [ ] Prompt boldness tuning — current prompt improvements are good but Josh wants more unexpected narrative leaps. More testing needed before adjusting further. Feedback: "if a man walking in the street, want to see him eating in a restaurant, meeting a friend."
- [ ] Fast model UX: overall latency is ~10s (Claude + FAL storage upload). Optimistic UI helps perceived speed but actual time is still slow.

### Low priority / deferred
- [ ] Model name on variant cards shows original generation model, not Kontext — low priority per Josh
- [ ] ngrok / local HTTPS proxy — not needed, base64 approach handles local dev

---

## How the "More" Feature Works (for context)

1. User hovers image → clicks "More"
2. **Client**: immediately inserts 2 optimistic placeholder cards inline (sorted by `created_at + 1s/2s`)
3. **Server** (`generate-variation.server.ts`):
   - Fetches source image `storage_path` from Supabase
   - Fetches image bytes → base64 (Claude) + uploads to FAL storage (FAL URL)
   - Calls Claude Sonnet with image + original prompt → 2 varied prompts
   - Submits both to `fal-ai/flux-pro/kontext` with `image_url`
   - Inserts 2 pending DB records with `created_at` offset from source
4. **Client**: realtime INSERT replaces optimistic placeholders; on server return, cleans up any remaining optimistic + deduplicates real cards
5. **Realtime + polling**: updates cards as FAL completes

---

## Key Files
| File | Purpose |
|------|---------|
| `src/features/ai-images/models.ts` | Model list + defaults |
| `src/features/ai-images/server/generate-variation.server.ts` | "More" server function |
| `src/features/ai-images/server/generate-image.server.ts` | Main generation server function |
| `src/features/ai-images/server/check-pending-images.server.ts` | Polling / FAL result fetcher |
| `src/features/ai-images/components/PendingImageCard.tsx` | Loading card UI |
| `src/routes/dashboard/ai-images.tsx` | Main page — gallery, state, realtime |
