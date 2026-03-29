## Overview

Multi-model image generation with edit, variation, and reparenting workflows via FAL AI. The main gallery page shows all generated images with nested edit children under parent cards. A dedicated focused edit view provides a workspace for iterating on a single image.

## How It Works

1. User selects a model, enters a prompt (or generates one via AI), and chooses aspect ratio
2. Image submitted to FAL async queue, gallery polls for completion
3. Generated images stored in Supabase with `generation_metadata` tracking parent/root lineage
4. Variations use Claude Sonnet to rewrite prompts with "creative tension" -- always references the root image to prevent quality drift
5. Edit children displayed as nested thumbnails under parent cards in the gallery
6. Reparenting allows moving images between parent groups or detaching entirely

## Focused Edit View

A dedicated workspace at `/dashboard/edit/$imageId` for iterating on a single image.

- Source image displayed with prompt, model info, and generation metadata
- Generate edits using prompt + optional reference images
- Run variations with AI-generated prompts (via Claude Sonnet)
- Manage variation prompts with ref image picker before batch submission
- Pick a new parent to group the image under a different card in the gallery
- Aspect ratio detection from source image

### Key files

- `src/routes/dashboard/edit.$imageId.tsx` -- route
- `src/features/ai-images/hooks/use-edit-page.ts` -- source loading, aspect ratio, variants, parent picker

## Usage

- Navigate to AI Images from sidebar to see the gallery
- Click an image to open the lightbox, or click "Edit" to enter the focused edit view
- In the edit view: generate edits, run variations, manage prompts, reparent
- Use the generator panel on the gallery page for new generations

## Key Files

```
src/features/ai-images/
  models.ts                    -- model registry (FLUX, Kling, Seedream, GPT Image, etc.)
  types.ts                     -- SavedAiImage, generation_metadata with parent/root tracking
  constants.ts                 -- aspect ratio utilities (RATIO_TO_SIZE, detectAspectRatio)
  error-classification.ts      -- classifyError() for retryable vs permanent FAL errors
  hooks/
    use-ai-images-page.ts      -- master hook composing all sub-hooks
    use-generator.ts           -- prompt state, model selection, source image, generation
    use-images.ts              -- gallery fetch, polling, deletion, reordering
    use-variations.ts          -- variation prompt generation and submission
    use-lightbox.ts            -- fullscreen viewer with merged parent+child list
    use-edit-children.ts       -- nested edit children under parent cards
    use-reparent.ts            -- adopt/detach images between parents
    use-edit-page.ts           -- focused edit view state
  components/
    GeneratorPanel.tsx          -- prompt input, aspect ratio, model selector, ref images
    ImageGallery.tsx            -- image grid with nested edit children thumbnails
    ImageLightbox.tsx           -- fullscreen lightbox viewer
    ImageCard.tsx               -- single card with model label, edit children grid, actions
    VariationPromptsDialog.tsx  -- manage variation prompts with ref image picker
    ParentPickerDialog.tsx      -- select new parent for reparenting
  server/
    generate-image.server.ts   -- text-to-image and image-to-image via FAL queue
    edit-image.server.ts       -- edit existing image with prompt + reference images
    generate-variation.server.ts       -- Claude Sonnet rewrites prompt, generates via edit model
    generate-variation-prompts.server.ts -- batch variation prompt generation
    submit-variations.server.ts        -- batch submit variation prompts
    reparent-image.server.ts           -- move image under new parent or detach
    fal-params.server.ts               -- buildFalInput() resolves params per model schema
```

## Dependencies

- FAL AI -- image model inference (async queue)
- Supabase -- image storage, realtime subscriptions
- Claude Sonnet (via Vercel AI SDK) -- variation prompt generation
- `@/features/credits/` -- credit deduction (1 credit per generation)
- `@/features/user-images/` -- image picker for reference images

## Route

- `/dashboard/ai-images` -- gallery + generation page
- `/dashboard/edit/$imageId` -- focused edit view

## Configuration

- `FAL_KEY` -- FAL API key (server-side)
