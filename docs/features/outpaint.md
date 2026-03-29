## Overview

Takes a source image and extends it to a new aspect ratio using FAL AI edit models. Includes a draggable preview for positioning the source image within the target frame. Also available as a quick dialog from other features (e.g., Multi-Shot start image).

## How It Works

1. Select source image from library or upload
2. Choose target aspect ratio and model
3. Optionally drag source image to position within target frame (normalized 0-1 coordinates)
4. Server composes at offset using `sharp`, sends to FAL for outpainting
5. Centered position (0.5, 0.5) passes original image as-is

## Usage

- Navigate to Dev Workspace > Outpaint
- Or use QuickOutpaintDialog from Multi-Shot start image

## Key Files

- `src/features/outpaint/server/outpaint-image.server.ts` -- FAL/Google API calls, image composition with offset via sharp
- `src/features/outpaint/hooks/useOutpaintPage.ts` -- Page state, model selection (3 models), offset, image library, polling
- `src/features/outpaint/hooks/useQuickOutpaint.ts` -- Lightweight hook for dialog usage outside main page
- `src/features/outpaint/components/OutpaintPageContent.tsx` -- Main layout (control card + results grid)
- `src/features/outpaint/components/OutpaintPreview.tsx` -- Interactive draggable offset positioning (min 25px visible, 0.35 drag resistance)
- `src/features/outpaint/components/QuickOutpaintDialog.tsx` -- Modal for quick outpaint from other features

### Supported Models

- Nano Banana 2 (reasoning-guided)
- Nano Banana Pro (realism + typography)
- GPT Image 1.5

## Dependencies

- FAL AI -- edit model inference
- `sharp` -- server-side image composition
- `@/features/credits/` -- 1 credit per generation

## Route

`/dashboard/dev-workspace/outpaint`
