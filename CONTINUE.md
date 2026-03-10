# Continue: Shots Pipeline Rebuild

## What was being worked on

Complete rebuild of `src/features/shots/` from a mock 3-step wizard into a real AI pipeline: select image → describe via LLM vision → generate variation prompts → generate images via FAL.

## Changes made so far

**New server functions (3 files):**

- `server/describe-shot-image.server.ts` -- wraps `describeImage('reconstruct')` as a TanStack server fn
- `server/generate-shot-prompts.server.ts` -- Haiku generates asterisk-delimited variation prompts from description + template
- `server/generate-shot-images.server.ts` -- batch FAL submit via `buildFalInput()` + `createPendingGeneration()`, 1 credit per image

**Hook rewrite (`hooks/useShotsPage.ts`):**

- Auto-describes image on selection (useEffect with ref tracking)
- `SHOT_MODELS` array: Kontext Pro (default) + Nano Banana 2
- `promptCount` state (1-10) with `buildTemplate(count)` helper auto-updating template text
- Single `generateImages()` action chains: prompt generation → split by `*` → FAL batch submit
- `canGenerate` / `isGenerating` derived state for button enablement
- Uses `useGenerationResults({ generationType: 'shot' })` for results + polling

**Component rewrites:**

- `ShotsPipelineStep.tsx` -- collapsible (chevron toggle, `defaultOpen` prop), no Run button in header
- `ShotsPageContent.tsx` -- 3-column layout:
  - Left (w-64): ImageSourceButtons + image preview + Reset
  - Middle (w-80): 3 collapsible steps + single "Generate Images" button
    - "Image Description" -- auto-runs, expand to edit
    - "Prompt Template" -- +/- stepper for count, editable template text
    - "Prompts" -- slide view (1 of N) with prev/next, each prompt editable, only shows after generation
  - Right (flex-1): model dropdown (Kontext Pro / Nano Banana 2) + `GenerationResultsGrid` (shared component with Lightbox click-to-view + delete)

**Updated:** `index.ts` (added ShotsPipelineStep export), `CLAUDE.md` (full rewrite)

## Key decisions

- Reuse `GenerationResultsGrid` from `src/components/` for results display -- gets Lightbox (view + delete + keyboard nav) for free
- `generationType: 'shot'` in DB metadata to filter results
- Kontext Pro (`fal-ai/flux-pro/kontext`) default model; Nano Banana 2 (`fal-ai/nano-banana-2/edit`) as alternative
- Prompts delimited by `*` in raw LLM output, split client-side
- No separate "Run All" vs "Generate" -- single button chains everything
- Split Prompts step hidden entirely (internal detail)

## Outstanding work

- **Not yet committed** -- all changes are unstaged on `main` branch
- Storyboard files also have uncommitted changes from a prior session (StoryInput.tsx, useStoryboardPage.ts, etc.)
- Could add: image lightbox for the source image preview, more models in dropdown, persist model selection to localStorage
- The prompt slide view could support adding/removing individual prompts before generating

## Git state

- Branch: `main`, all changes uncommitted and unstaged
- Mix of shots pipeline work + prior storyboard changes in the diff
- `pnpm build` passes clean
