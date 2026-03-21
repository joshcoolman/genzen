# Outpaint Feature

Extends images to new aspect ratios using FAL AI edit models.

## Key Files

- `server/outpaint-image.server.ts` -- server fn, FAL API call, aspect ratio handling
- `hooks/useOutpaintPage.ts` -- page state, model selection, polling
- `hooks/useQuickOutpaint.ts` -- lightweight outpaint hook for use outside the dedicated page
- `components/OutpaintPageContent.tsx` -- main page layout
- `components/OutpaintPreview.tsx` -- source image + target ratio preview
- `components/OutpaintCard.tsx` -- individual result card
- `components/QuickOutpaintDialog.tsx` -- dialog for quick outpaint from other features
- `index.ts` -- barrel export (OutpaintPageContent, useOutpaintPage, useQuickOutpaint, QuickOutpaintDialog)

## Route

`src/routes/dashboard/dev-workspace.outpaint.tsx`

## Shared Dependencies

- `src/features/ai-images/server/fal-params.server.ts` -- `buildFalInput()` resolves size/safety/image params per model schema
- `src/features/ai-images/server/fal-schema.server.ts` -- fetches + caches FAL OpenAPI schemas at runtime
- `src/features/ai-images/constants.ts` -- `RATIO_TO_SIZE` (width/height objects)
- `src/features/ai-images/models.ts` -- model definitions incl. `EDIT_MODELS`

## Model Quirks

- **nano-banana**: only accepts 11 aspect ratios (see `NANO_BANANA_RATIOS` set in server file). Unsupported ratios fall back to `"auto"` with the target ratio encoded in the prompt.
- **GPT Image 1.5** (`fal-ai/gpt-image-1.5/edit`): accepts resolution enum strings (`auto`, `1024x1024`, `1536x1024`, `1024x1536`), not width/height objects. Handled by `buildFalInput()` via `isResolutionEnum` priority check.
