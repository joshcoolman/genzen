Run a text prompt against multiple LLMs in parallel and compare results side-by-side.

## Key Files

- `types.ts` -- PromptMode configs (image-prompt, story-beat, free), ModelResult type, default negative prompt
- `text-models.ts` -- TEXT_MODELS registry (5 models) and TEXT_MODEL_MAP to Vercel AI SDK instances
- `hooks/usePromptStudio.ts` -- Page state: prompt, mode, system prompt, negative prompt, model selection, run lifecycle
- `server/run-prompt-studio.server.ts` -- Server function: runs generateText across selected models via Promise.allSettled
- `components/PromptStudioContent.tsx` -- Three-column layout (prompt, system prompt, avoid words) + mode/model selectors + results grid
- `components/ModelResultCard.tsx` -- Displays single model result with provider, duration, copy button
- `index.ts` -- barrel export (PromptStudioContent, usePromptStudio)

## Route

`src/routes/dashboard/dev-workspace.prompt-studio.tsx`

## Models

1. Claude Sonnet (Anthropic)
2. Claude Haiku (Anthropic)
3. Gemini Flash (Google)
4. Grok (xAI)
5. Nemotron Super (NVIDIA via OpenRouter) -- fast reasoning, 120B MoE

## Shared Dependencies

- `@/lib/server/ai.server` -- Vercel AI SDK model instances (`models.sonnet`, `models.haiku`, `models.geminiFlash`, `models.grok`, `models.nemotron`)
- `@/lib/server/auth.server` -- requireAuth
- `@/lib/auth` -- useAuth for session access token
- `@/components/ModelMultiSelect` -- Multi-select toggle for choosing which models to run
- `@/components/ActionButton` -- Shared loading button

## Quirks / Notes

- System prompt and negative prompt persist to localStorage across sessions
- Negative prompt is appended to system prompt as "NEVER use these words" instruction
- Switching modes overwrites the system prompt with the mode's preset
- All models run concurrently via Promise.allSettled -- partial failures don't block others
- Execution duration captured and displayed per-model
- No credit system integration -- runs are free
- Cmd+Enter keyboard shortcut triggers run from any textarea
- All 5 models selected by default
