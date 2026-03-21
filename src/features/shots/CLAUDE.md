Linear pipeline for generating image variations: select source image -> describe with vision -> generate variation prompts via LLM -> split prompts -> generate images from each prompt + source.

## Key Files

- `index.ts` -- barrel exports
- `hooks/useShotsPage.ts` -- pipeline state machine with step status tracking and chained execution
- `components/ShotsPageContent.tsx` -- 3-column layout (source image | pipeline steps | generated results)
- `components/ShotsPipelineStep.tsx` -- reusable step card with status indicator and optional Run button
- `server/describe-shot-image.server.ts` -- step 1, LLM vision via `describeImage('reconstruct')`
- `server/generate-shot-prompts.server.ts` -- step 3, LLM multi-prompt generation via Haiku
- `server/generate-shot-images.server.ts` -- step 5, FAL batch submit via Kontext Pro (img2img)

## Route

`src/routes/dashboard/dev-workspace.shots.tsx`

## Shared Dependencies

- `src/lib/server/describe-image.server.ts` -- vision description
- `src/lib/server/ai.server.ts` -- LLM model instances
- `src/features/ai-images/server/fal-params.server.ts` -- `buildFalInput()` for FAL submissions
- `src/lib/server/create-pending-generation.server.ts` -- DB record creation
- `src/lib/hooks/useGenerationResults.ts` -- results polling + realtime with `generationType: 'shot'`
- `src/components/ImageSourceButtons/` -- upload, library picker, clipboard paste
- `src/features/user-images/hooks/useExistingImages.ts` -- user's image library
- `src/features/credits/server/check-credits.server.ts` -- credit deduction per image

## Quirks / Notes

- Default model is Kontext Pro (`fal-ai/flux-pro/kontext`) for subject-consistent img2img
- Prompts are asterisk-delimited (`*`) in raw LLM output, split in step 4
- Step 2 (prompt template) is always editable, no server call
- `runAll()` chains steps 1 -> 3 -> generate sequentially
- Each generated image costs 1 credit (checked per prompt in batch)
