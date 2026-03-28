Run a text prompt (with optional image) against multiple LLMs in parallel and compare results side-by-side. Includes saveable prompt sets for A/B testing different prompt configurations.

## Key Files

- `types.ts` -- DEFAULT_SYSTEM_PROMPT, DEFAULT_NEGATIVE_PROMPT, ModelResult, PromptSet types
- `text-models.ts` -- TEXT_MODELS registry (5 models, with `supportsVision` flag) and TEXT_MODEL_MAP to Vercel AI SDK instances
- `hooks/usePromptStudio.ts` -- Page state: prompt, system prompt, negative prompt, image, model selection, prompt sets integration, run lifecycle
- `hooks/usePromptSets.ts` -- localStorage CRUD for saved prompt sets (save, update, delete, rename, load)
- `server/run-prompt-studio.server.ts` -- Server function: runs generateText across selected models via Promise.allSettled, supports multimodal (image+text) messages
- `components/PromptStudioContent.tsx` -- Layout: image picker + three-column textareas (prompt, system prompt, avoid) + model selector + results grid + sidebar toggle
- `components/PromptSetsSidebar.tsx` -- Collapsible right panel for managing saved prompt sets
- `components/ModelResultCard.tsx` -- Displays single model result with provider, duration, copy button
- `index.ts` -- barrel export (PromptStudioContent, usePromptStudio)

## Route

`src/routes/dashboard/dev-workspace.prompt-studio.tsx`

## Models

1. Claude Sonnet (Anthropic) -- vision
2. Claude Haiku (Anthropic) -- vision
3. Gemini Flash (Google) -- vision
4. Grok (xAI) -- vision
5. Nemotron Super (NVIDIA via OpenRouter) -- text-only

## Prompt Sets

- Stored in localStorage (`prompt-studio-sets`)
- Each set: name, prompt, systemPrompt, negativePrompt, timestamps
- Active set tracking with dirty detection
- Update existing or save as new when modified

## Shared Dependencies

- `@/lib/server/ai.server` -- Vercel AI SDK model instances
- `@/lib/server/auth.server` -- requireAuth
- `@/lib/auth` -- useAuth for session access token
- `@/components/ModelMultiSelect` -- Multi-select toggle for choosing which models to run
- `@/components/ActionButton` -- Shared loading button
- `@/components/ImageSourceButtons` -- Library picker + file upload + clipboard paste
- `@/features/user-images/hooks/useUserImages` -- User image library for picker

## Quirks / Notes

- System prompt and negative prompt persist to localStorage across sessions
- Negative prompt is appended to system prompt as "NEVER use these words" instruction
- When an image is attached, non-vision models are auto-deselected and can't be re-selected
- All models run concurrently via Promise.allSettled -- partial failures don't block others
- Image is sent as base64 data URL via multimodal messages format
- Cmd+Enter keyboard shortcut triggers run from any textarea
- All 5 models selected by default (vision-only subset when image attached)
- No credit system integration -- runs are free
