## Overview

A/B testing tool for prompts. Enter a prompt (with optional image), select which models to run, and see all responses simultaneously. Includes saveable prompt sets for reuse.

## How It Works

1. Enter prompt, system prompt, and optional negative prompt
2. Optionally attach an image (non-vision models auto-deselected)
3. All selected models run concurrently via Promise.allSettled
4. Results displayed side-by-side with timing info
5. Prompt sets saved to localStorage for reuse

## Usage

- Navigate to Dev Workspace > Prompt Studio
- Enter prompt, select models, run (Cmd+Enter shortcut)
- Save prompt configurations as named sets

## Key Files

- `src/features/prompt-studio/text-models.ts` -- 5 models with `supportsVision` flag
- `src/features/prompt-studio/server/run-prompt-studio.server.ts` -- Runs generateText across models via Promise.allSettled
- `src/features/prompt-studio/hooks/usePromptStudio.ts` -- Page state, model selection, prompt sets, run lifecycle
- `src/features/prompt-studio/hooks/usePromptSets.ts` -- localStorage CRUD for saved prompt sets
- `src/features/prompt-studio/components/PromptStudioContent.tsx` -- Three-column textareas, model selector, results grid
- `src/features/prompt-studio/components/PromptSetsSidebar.tsx` -- Collapsible sidebar for managing saved sets
- `src/features/prompt-studio/components/ModelResultCard.tsx` -- Single model result with provider, duration, copy

### Available Models

| Model          | Provider            | Vision |
| -------------- | ------------------- | ------ |
| Claude Sonnet  | Anthropic           | Yes    |
| Claude Haiku   | Anthropic           | Yes    |
| Gemini Flash   | Google              | Yes    |
| Grok           | xAI                 | Yes    |
| Nemotron Super | NVIDIA (OpenRouter) | No     |

## Dependencies

- Vercel AI SDK -- model inference
- No credit system -- runs are free

## Route

`/dashboard/dev-workspace/prompt-studio`
