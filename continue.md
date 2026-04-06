# Continue: Prompt Studio Improvements & Model Onboarding

## What was worked on

Prompt Studio (`src/features/prompt-studio/`) -- adding new models, fixing bugs, and improving evaluation workflow. Also added marketing content to the home page.

## Changes made (all committed and pushed to main)

### Model additions

- **Gemma 4 31B** added via OpenRouter (`google/gemma-4-31b-it`) -- `isNew: true` flag, registered in `text-models.ts`, `ai.server.ts`, `prompt-studio/text-models.ts`
- **Grok upgraded** from `grok-3-mini` (no vision) to `grok-4-1-fast-non-reasoning` (vision capable) via xAI direct
- Nemotron stays on `nvidia/nemotron-3-super-120b-a12b` via OpenRouter

### "New" badge system

- Added `new` variant to `src/components/ui/badge.tsx` using `--warm-gold: #d4a853`
- `TextModel` interface gained `isNew?: boolean` in `src/lib/text-models.ts`
- `ModelMultiSelect.tsx` renders `<Badge variant="new">` when `isNew` is true
- Settings page (`settings.tsx`) shows inline "new" badge next to "vision" badge

### Home page model showcase

- Created `src/components/ModelShowcase.tsx` -- pulls from `ALL_IMAGE_MODELS`, `ALL_VIDEO_MODELS`, `ALL_TEXT_MODELS` so it auto-syncs
- Three sections: Text to Image (13), Video (8), Text (7)
- Added `<GlobalNav />` to home page (was missing)
- Home page layout changed from centered to top-down flow with `max-w-3xl` showcase section

### Prompt Studio fixes

- **Library picker fix**: replaced `fetch()`-based `urlToBase64` with `canvas + img.crossOrigin = 'anonymous'` approach (CORS fix for R2 URLs) in `PromptStudioContent.tsx`
- **"Copy Results" button**: formats all run outputs as structured markdown (prompt, system prompt, per-model results sorted by speed) -- uses `formatResults()` function
- **Better error reporting**: `run-prompt-studio.server.ts` now digs into Vercel AI SDK `.cause` chain and `.responseBody` to surface actual provider errors instead of generic messages

## Key decisions

- **OpenRouter for new models** when no direct API available (Gemma 4 not on Gemini API, only downloadable or via OpenRouter)
- **Non-reasoning Grok variant chosen** for speed -- reasoning overhead not needed for creative prompt writing tasks. Can swap to `grok-4-1-fast-reasoning` with one line if quality is lacking
- **Grok `supportsVision: false` for grok-3-mini** was a bug -- was marked true, causing "Bad Request" when images attached
- xAI account needed credits added at `console.x.ai` -- was returning "Forbidden" before funding
- Gemma 4 has intermittent OpenRouter failures ("Provider returned error") -- likely cold-start or provider availability. First run was 104s, subsequent runs 6s

## Outstanding work (user wants to continue on Prompt Studio)

1. **Incremental results**: Currently `Promise.allSettled` waits for ALL models before showing ANY results. User wants results to appear as each model finishes -- this is the biggest UX improvement pending
2. **Session history**: Save run results to localStorage or Supabase so past runs can be reviewed
3. **Observability/logging**: User expressed interest in better debugging, error tracking, and operational visibility across the app
4. **xAI Imagine models**: `grok-imagine-image`, `grok-imagine-image-pro`, `grok-imagine-video` are available on the account -- could be added to image/video model registries
5. **Nemotron `supportsVision`**: Currently `false` -- should verify if the OpenRouter model supports vision

## Model performance benchmarks (from user testing)

| Model         | Speed               | Vision | Quality (prompt writing)     |
| ------------- | ------------------- | ------ | ---------------------------- |
| Grok 4        | 3.0s                | Yes    | Strong, specific details     |
| Claude Haiku  | 3.9-5.2s            | Yes    | Best speed/quality ratio     |
| Gemma 4       | 6.0s (after warmup) | Yes    | Functional but less detailed |
| Claude Sonnet | 6.9-7.8s            | Yes    | Most precise/cinematic       |
| Gemini Flash  | 7.1-8.5s            | Yes    | Good but slightly generic    |
| GPT-4o Mini   | 2.3-9.1s            | Yes    | Refused image-related tasks  |
| Nemotron      | untested            | No     | Text-only                    |

## Git state

- Branch: `main`, all changes committed and pushed
- 3 commits this session: `06f2ae6`, `aa16f90`, `5d46641`
- GitHub issue #122 closed by first commit

## Key files

- `src/features/prompt-studio/components/PromptStudioContent.tsx` -- main UI, formatResults, urlToBase64
- `src/features/prompt-studio/server/run-prompt-studio.server.ts` -- server execution, error handling
- `src/features/prompt-studio/hooks/usePromptStudio.ts` -- state management
- `src/lib/text-models.ts` -- TextModel interface + ALL_TEXT_MODELS
- `src/lib/server/ai.server.ts` -- model SDK instances
- `src/components/ModelShowcase.tsx` -- home page showcase
- `src/components/ui/badge.tsx` -- badge variants including "new"
