Run a text prompt against multiple LLMs in parallel and compare results side-by-side.

## Key Files

- `types.ts` -- PromptMode configs (image-prompt, story-beat, free), ModelResult type, default negative prompt
- `text-models.ts` -- TEXT_MODELS registry (Claude Sonnet, Haiku, Gemini Flash, Grok) and TEXT_MODEL_MAP to Vercel AI SDK instances
- `hooks/usePromptStudio.ts` -- Page state: prompt, mode, system prompt, negative prompt, model selection, run lifecycle
- `server/run-prompt-studio.server.ts` -- Server function: runs generateText across selected models via Promise.allSettled
- `components/PromptStudioContent.tsx` -- Three-column layout (prompt, system prompt, avoid words) + mode/model selectors + results grid
- `components/ModelResultCard.tsx` -- Displays single model result with provider, duration, copy button

## Route

`src/routes/dashboard/prompt-studio.tsx`

## Shared Dependencies

- `@/lib/server/ai.server` -- Vercel AI SDK model instances (ai.sonnet, ai.haiku, ai.geminiFlash, ai.grok)
- `@/lib/server/auth.server` -- requireAuth
- `@/lib/auth` -- useAuth for session access token
- `@/components/ModelMultiSelect` -- Multi-select toggle for choosing which models to run
- `@/components/ActionButton` -- Shared loading button

## Quirks / Notes

- System prompt and negative prompt persist to localStorage across sessions
- Negative prompt is appended to system prompt as "NEVER use these words" instruction
- Switching modes overwrites the system prompt with the mode's preset
- All models run concurrently via Promise.allSettled -- partial failures don't block others
- No credit system integration -- runs are free
- Cmd+Enter keyboard shortcut triggers run from any textarea
