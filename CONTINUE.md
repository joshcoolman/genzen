## Storyboard: Story tab -- two-tier generation (style frames + story frame)

Branch: `feature/storyboard-blockout` (uncommitted changes, build passes)

### What was built this session

Wired up real FAL AI generation for the Story tab's style frame feature. Previously all mocks.

**New file:** `src/features/storyboard/server/generate-style-frame.server.ts`

- Server action: takes story text + auth, builds "cinematic establishing shot" prompt, submits to FAL Schnell at 16:9, creates `user_images` record with `generation_type: 'style_frame'`

**Updated:** `src/features/storyboard/hooks/useStoryboardPage.ts`

- Uses `useAuth()` + `useGenerationResults({ generationType: 'style_frame' })` for automatic polling, realtime subscription, signed URL resolution
- Selection state: `selectedStyleFrameId`, auto-selects latest completed, click to select from grid
- Exposes `styleFrameResults`, `selectStyleFrame`, `deleteStyleFrame` for the grid UI
- Style tags still mock (`MOCK_STYLE_TAGS`) -- not derived from images yet

**Updated:** `src/features/storyboard/components/StoryInput.tsx`

- Large preview shows selected style frame image (or spinner while pending)
- `GenerationResultsGrid` below with select (click), delete (trash), selection highlight ring
- Button stays enabled for regeneration (only disabled while generating)

**Updated:** `src/components/GenerationResultsGrid.tsx`

- Added optional `onSelect`/`selectedId` props -- when `onSelect` provided, clicking a card calls it instead of opening lightbox; selected card gets `border-primary ring-1 ring-primary`

### Next step: Two-tier generation system

The user discovered through interaction that the Story tab needs two tiers:

**Tier 1 -- Style Frames (explore)**

- Fast Schnell generations for mood/style discovery
- User generates, keeps favorites, deletes rejects
- Capped at 14 images (nano-banana-2's `maxRefImages` limit)
- Already built and working

**Tier 2 -- Story Frame (refine)**

- Below the style frames section
- "Generate Story Frame" button sends ALL style frames as reference images to nano-banana-2's edit endpoint
- Also sends: the story text as prompt context
- Produces one refined image that synthesizes the visual DNA from all the mood anchors
- Same grid pattern (generate, keep/delete, select)
- The selected story frame is what flows into the Elements tab as THE visual reference

**Implementation plan:**

1. New server action `generate-story-frame.server.ts` -- uses `fal-ai/nano-banana-2/edit` with `image_urls` (signed URLs of all style frames) + story-derived prompt
2. New `useGenerationResults({ generationType: 'story_frame' })` in the hook
3. UI: "Story Frame" section below style frames in `StoryInput.tsx` with its own `GenerationResultsGrid`
4. The selected story frame's `recordId`/URL flows to elements step

**Key references for wiring:**

- `src/features/ai-images/server/edit-image.server.ts` -- existing edit endpoint that supports ref images via `image_urls`
- `src/features/edit-image/hooks/useEditModels.ts` -- nano-banana-2 `maxRefImages: 14`
- `src/features/ai-images/server/fal-params.server.ts` -- `buildFalInput()` handles `image_urls` for nano-banana models
- `src/lib/hooks/useGenerationResults.ts` -- shared polling/realtime hook (already used for style frames)

### Other state from prior sessions

- Mock style tags still hardcoded -- eventually derive from LLM or image analysis
- Other mocks remain: refine story, extract elements, generate scenes (all setTimeout)
- Issue #57 -- cinematic style presets from sandbox (not started)
- Scene frames still use gradient PlaceholderCards

### Git state

Branch `feature/storyboard-blockout`, storyboard + shared component changes uncommitted. `pnpm build` passes.
