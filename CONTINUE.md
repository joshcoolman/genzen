# Continue: Google Direct Provider for Nano Banana 2

## Branch: `model-abstraction` (all committed, clean)

## What was built

Provider-aware media generation layer (Epic #81 starter). Nano-banana-2 routes through Google instead of FAL proxy for cost savings (~2-4x).

## Key files

- `src/lib/server/google-imagen.server.ts` -- Google adapter (currently Vertex AI mode with `generateImages`/`editImage`)
- `src/lib/server/media.server.ts` -- Provider router: `submitGeneration()` + `isGoogleProvider()`
- `src/features/ai-images/models.ts` -- Added `provider?: 'fal' | 'google'` to `ImageModel`, set on nano-banana-2
- Modified server files to route through `submitGeneration()`: `generate-image.server.ts`, `generate-variation.server.ts`, `submit-variations.server.ts`, `outpaint-image.server.ts`, `generate-storyboard-frame.server.ts`
- `src/features/ai-images/hooks/use-images.ts` -- Fixed trash restore (restored images now re-appear in gallery via realtime)

## Architecture

- Two-phase pending record: create `status: 'pending'` immediately, call Google, update to `completed`. Safe for page navigation.
- Google records have no `request_id`, poller skips them (`.not('request_id', 'is', null)`)
- On failure, record marked `status: 'failed'` with error in metadata
- Reference images fetched as base64 for Google path (not FAL URLs)
- `edit-image.server.ts` (edit page) NOT modified -- still goes through FAL

## Current state: Vertex AI path works but has a blocker

**Text-to-image**: Works great. `generateImages` with `imagen-4.0-generate-001`, native `aspectRatio` param, fast.

**Single-image edit**: Works. `editImage` with `imagen-3.0-capability-001`, native `aspectRatio`.

**Multi-image (source + reference images from library)**: BROKEN. Vertex AI `editImage` only accepts 1 `RawReferenceImage`. FAL nano-banana accepts multiple `image_urls` -- this is how image combining works. The user's core workflow involves selecting 2+ images and combining them with a prompt.

## The decision point

The user is experimenting with something before deciding. Options discussed:

1. **Fall back to FAL** -- one-line change: remove `provider: 'google'` from models.ts. All infrastructure stays for future use.
2. **Hybrid approach** -- Vertex AI for text-to-image + single-image edit (aspect ratio works), Gemini `generateContent` for multi-image (no aspect ratio control but multi-image works). Would need both auth paths active.
3. **Stay on Vertex AI** -- accept single-image limitation, user adjusts workflow.

## Auth setup (already done)

- GCP project: `gen-lang-client-0015600225` (aisdk)
- Service account: `genzen@gen-lang-client-0015600225.iam.gserviceaccount.com`
- Key file: `~/.keys-genzen/gen-lang-client-0015600225-00a87d4d2b71.json`
- Env var: `GOOGLE_APPLICATION_CREDENTIALS` (local), `GOOGLE_SERVICE_ACCOUNT_JSON` (deploy via Vercel)
- Vertex AI API: enabled
- Also has Gemini API key: `GOOGLE_AI_API_KEY` (for potential hybrid approach)

## To fall back to FAL immediately

In `src/features/ai-images/models.ts`, remove `provider: 'google'` from nano-banana-2 entry. Everything routes back through FAL. No other changes needed.
