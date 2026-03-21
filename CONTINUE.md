# Continue: Google Direct Provider for Nano Banana 2

## Branch: `model-abstraction` (all committed, clean, nano-banana-2 currently on FAL)

## What was built

Provider-aware media generation layer (Epic #81 starter). Full adapter infrastructure in place, tested with both Gemini API and Vertex AI. Currently fallen back to FAL pending one more approach.

## Key files

- `src/lib/server/google-imagen.server.ts` -- Google adapter (currently Vertex AI mode, needs to switch back to Gemini `generateContent` with `imageConfig`)
- `src/lib/server/media.server.ts` -- Provider router: `submitGeneration()` + `isGoogleProvider()`
- `src/features/ai-images/models.ts` -- Added `provider?: 'fal' | 'google'` to `ImageModel`. Currently no provider set on nano-banana-2 (FAL default). Add `provider: 'google'` to re-enable.
- Modified server files to route through `submitGeneration()`: `generate-image.server.ts`, `generate-variation.server.ts`, `submit-variations.server.ts`, `outpaint-image.server.ts`, `generate-storyboard-frame.server.ts`
- `src/features/ai-images/hooks/use-images.ts` -- Fixed trash restore (restored images now re-appear in gallery via realtime)

## BREAKTHROUGH: imageConfig.aspectRatio on generateContent

The `@google/genai` SDK has an `imageConfig` param on `generateContent` that we never used:

```ts
const response = await ai.models.generateContent({
  model: 'gemini-2.5-flash-image',
  contents: [{ role: 'user', parts: [...imageParts, { text: prompt }] }],
  config: {
    responseModalities: ['image', 'text'],
    imageConfig: {
      aspectRatio: '16:9', // NATIVE PARAM -- not prompt-based!
    },
  },
})
```

This was confirmed by Gemini's own docs. `ImageConfig` supports:

- `aspectRatio`: '1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9', '21:9'
- `imageSize`: '1K', '2K', '4K'
- `personGeneration`: 'ALLOW_ALL', 'ALLOW_ADULT', 'ALLOW_NONE'

Multi-image limits:

- `gemini-2.5-flash-image`: up to 3 input images
- `gemini-3-pro-image` (Nano Banana Pro): up to 14 reference images

## Next step

Rewrite `google-imagen.server.ts` to use `generateContent` (not Vertex AI `editImage`) with:

1. Multiple inline image parts (base64)
2. `imageConfig: { aspectRatio }` for native aspect ratio control
3. Can use either Gemini API key or Vertex AI auth

This should give us multi-image combining + aspect ratio control + speed. The earlier `generateContent` path worked great for image quality and combining -- we just didn't know about `imageConfig`.

## Architecture (unchanged)

- Two-phase pending record: create `status: 'pending'` immediately, call Google, update to `completed`. Safe for page navigation.
- Google records have no `request_id`, poller skips them
- On failure, record marked `status: 'failed'`
- Reference images fetched as base64 for Google path
- `edit-image.server.ts` (edit page) NOT modified -- still goes through FAL

## Auth setup (both paths available)

- GCP project: `gen-lang-client-0015600225` (aisdk)
- Service account key: `~/.keys-genzen/gen-lang-client-0015600225-00a87d4d2b71.json`
- Env vars: `GOOGLE_APPLICATION_CREDENTIALS` (local Vertex AI), `GOOGLE_SERVICE_ACCOUNT_JSON` (deploy), `GOOGLE_AI_API_KEY` (Gemini API key)
- Vertex AI API: enabled

## To re-enable Google

1. In `models.ts`, add `provider: 'google'` back to nano-banana-2
2. Rewrite `google-imagen.server.ts` to use `generateContent` with `imageConfig`
