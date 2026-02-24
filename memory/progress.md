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
- **Optimistic inline UI**: 2 placeholder cards appear immediately on "More" click, sorted next to source by timestamp offset
- **Realtime INSERT** now sorts by `created_at` instead of prepending (fixes cards appearing at top)
- **"More" button**: disabled/loading state during server call
- **Describe-first prompt strategy**: Claude observes the image visually (face, hair, outfit, accessories) and uses that as ground truth instead of relying on the text prompt
- **History awareness**: queries existing variation prompts in the family + source prompt, passes as "avoid" list so Claude never repeats similar scenarios
- **Batch dedup**: variation 2 in each batch sees variation 1's prompt
- **Root prompt resolution**: variations-of-variations trace back to original prompt, preventing creative tension collapse
- **Kontext guidance_scale 3.5 → 5.0**: text prompt gets more influence over reference image (face/identity preserved, but pose/scene can change)
- **Realtime race condition fix**: variation records arriving via realtime replace optimistic placeholders in-place
- **Family grouping in gallery**: images grouped by root ancestor (original + all descendants) so variation families never interleave with unrelated images. Optimistic cards include `source_image_id`/`generation_type` metadata for correct grouping. Standalone images render as single-item groups (no visual difference).

---

## Known Issues / Backlog

### High priority
- [ ] Variation card labeling — cards derived from an original show same model name + date as source, no indication they're variants. Need a visual treatment (label? subtle border? indicator?). Josh is still thinking about the right approach.

### Medium priority
- [ ] Variation drift — deeper variation chains (variation-of-variation-of-variation) drift further from original subject. Not urgent but worth monitoring.
- [ ] Fast model UX: overall latency is ~10s (Claude + FAL storage upload). Optimistic UI helps perceived speed but actual time is still slow.

### Low priority / deferred
- [ ] Model name on variant cards shows original generation model, not Kontext — low priority per Josh
- [ ] ngrok / local HTTPS proxy — not needed, base64 approach handles local dev

---

## How the "More" Feature Works (for context)

1. User hovers image → clicks "More"
2. **Client**: immediately inserts 2 optimistic placeholder cards inline (sorted by `created_at + 1s/2s`)
3. **Server** (`generate-variation.server.ts`):
   - Fetches source image `storage_path` + `generation_metadata` from Supabase
   - Resolves root prompt (traces back through variation chain to original)
   - Fetches image bytes → base64 (Claude) + uploads to FAL storage (FAL URL)
   - Queries existing variation prompts in the family for "avoid" list
   - Calls Claude Sonnet with image + avoid list → Claude describes what it sees, writes new scenario
   - Submits both to `fal-ai/flux-pro/kontext` with `image_url` + `guidance_scale: 5.0`
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
