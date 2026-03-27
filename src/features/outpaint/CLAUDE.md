# Outpaint Feature

Extends images to new aspect ratios using FAL AI edit models or Google Vertex API. Includes interactive offset positioning to control source placement within the target frame.

## Key Files

- `server/outpaint-image.server.ts` -- server fn, FAL/Google API calls, image composition with offset via sharp, aspect ratio handling
- `hooks/useOutpaintPage.ts` -- page state, model selection (3 models), offset management, image library integration, polling
- `hooks/useQuickOutpaint.ts` -- lightweight hook for aspect ratio detection and dialog management outside main page
- `components/OutpaintPageContent.tsx` -- main page layout (control card + results grid)
- `components/OutpaintCard.tsx` -- main control card: source picker, aspect ratio, model selector, outpaint button, preview
- `components/OutpaintPreview.tsx` -- interactive preview with draggable offset positioning (min visible: 25px, drag resistance: 0.35)
- `components/QuickOutpaintDialog.tsx` -- modal dialog for quick outpaint from other features with centered preview
- `index.ts` -- barrel export (OutpaintPageContent, useOutpaintPage, useQuickOutpaint, QuickOutpaintDialog, QuickOutpaintDialogProps)

## Route

`src/routes/dashboard/dev-workspace.outpaint.tsx`

## Supported Models

Defined in `useOutpaintPage.ts` (subset of ai-images EDIT_MODELS):

- `fal-ai/nano-banana-2/edit` -- Nano Banana 2 (reasoning-guided)
- `fal-ai/nano-banana-pro/edit` -- Nano Banana Pro (realism + typography)
- `fal-ai/gpt-image-1.5/edit` -- GPT Image 1.5

## Offset Positioning

- Source image can be dragged within target frame (normalized 0-1 coordinates, 0.5 = center)
- Out-of-bounds dragging with 0.35 resistance damping; minimum 25px visible
- Server composes at offset using `sharp` library (crops/clamps, neutral gray background)
- Centered (0.5, 0.5) passes through original image as-is (no composition)

## Shared Dependencies

- `src/features/ai-images/server/fal-params.server.ts` -- `buildFalInput()` resolves size/safety/image params per model schema
- `src/features/ai-images/server/fal-schema.server.ts` -- fetches + caches FAL OpenAPI schemas at runtime
- `src/features/ai-images/constants.ts` -- `RATIO_TO_SIZE` (width/height objects)
- `src/features/ai-images/models.ts` -- model definitions incl. `EDIT_MODELS`
- `src/features/credits/` -- `checkAndDeductCredits()`, `useCredits`, `CREDIT_COSTS.image_gen`
- `src/lib/hooks/useGenerationResults.ts` -- polling and result management
- `sharp` -- server-side image composition

## Model Quirks

- **nano-banana models**: only accept 11 native aspect ratios (see `NANO_BANANA_RATIOS` set). Unsupported ratios fall back to `"auto"` with target ratio encoded in prompt.
- **GPT Image 1.5** (`fal-ai/gpt-image-1.5/edit`): accepts resolution enum strings (`auto`, `1024x1024`, etc.), not width/height objects. Handled by `buildFalInput()` via `isResolutionEnum` priority check.
- Nano-banana models may use Google provider path; GPT Image 1.5 uses FAL only.
