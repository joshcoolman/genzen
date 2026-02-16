# AI Images

Generate images from text prompts using FAL's model library.

## Status

- [x] Complete

## Overview

Direct FAL API integration for text-to-image generation. No persistence or background jobs -- prompt in, image out. Supports multiple models and AI-assisted prompt generation.

## Implementation

### Key Files

- `src/features/ai-images/models.ts` - Model registry (id, name, description)
- `src/features/ai-images/server/generate-image.server.ts` - Server functions for image and prompt generation
- `src/routes/dashboard/ai-images.tsx` - UI with model selector, prompt input, generation display

### How It Works

1. User selects a model from the dropdown and enters a prompt (or clicks "Random Prompt")
2. `generateImage` server function calls `fal.subscribe(model, { input: { prompt } })`
3. Returns image URL, seed, timings, and elapsed time
4. `generatePrompt` calls `fal-ai/any-llm` with Gemini 2.5 Flash to produce creative prompts

### Available Models

| Model           | Description                       |
| --------------- | --------------------------------- |
| FLUX Schnell    | Fast, reliable default            |
| FLUX.2 Turbo    | Fastest, cheapest                 |
| FLUX.2 Max      | High quality FLUX                 |
| Nano Banana Pro | Google SOTA, realism + typography |
| Recraft V3      | SOTA benchmarks, vector art       |
| Grok Imagine    | xAI, highly aesthetic             |
| ImagineArt 1.5  | Professional realism              |

### Dependencies

- `@fal-ai/client` - FAL API client
- `FAL_KEY` environment variable

## Usage

Navigate to `/dashboard/ai-images`. Select a model, type or generate a prompt, and click Generate. The image displays below with generation timing.

## Configuration

- `FAL_KEY` - Required. FAL API key set as environment variable.

## Future Improvements

- Persist generated images to user library
- Image size/aspect ratio controls
- Batch generation
- Integration with Trigger.dev for durable generation (Issue #5)
