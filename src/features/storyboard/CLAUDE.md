Storyboard feature -- linear pipeline: story prompt -> scene breakdown -> frame generation.

## Key Files

- `index.ts` -- barrel exports
- `types.ts` -- Scene, Storyboard interfaces, FRAME_MODELS
- `hooks/useStoryboard.ts` -- state management: story editing, scene generation, frame tracking, auto-save
- `components/StoryboardPage.tsx` -- main page layout with progressive reveal
- `components/StoryPromptSection.tsx` -- story textarea with Refine + Generate Scenes buttons
- `components/SceneList.tsx` -- scene list with model selector + Generate All Frames
- `components/SceneCard.tsx` -- single scene: editable visual_description/caption, frame image, generate button
- `components/TimelineStrip.tsx` -- sticky bottom thumbnail strip for scene navigation
- `server/refine-story.server.ts` -- Claude Haiku expands rough prompt into cinematic narrative
- `server/generate-scenes.server.ts` -- Claude Haiku breaks story into 8-12 structured scenes (JSON)
- `server/generate-storyboard-frame.server.ts` -- FAL image generation per scene's visual_description
- `server/save-storyboard.server.ts` -- upsert storyboard to Supabase
- `server/load-storyboard.server.ts` -- load most recent or specific storyboard

## Route

`src/routes/dashboard/storyboard.tsx`

## Data Model

- `storyboards` table: id, user_id, title, story_prompt, refined_story, scenes (JSONB), status
- Generated frames stored in `user_images` with `generation_type: 'storyboard_frame'`
- Scene JSONB includes: visual_description (doubles as image prompt), framing, camera, caption, image_id

## Flow

```
story prompt -> [refine] -> [generate scenes] -> edit scenes -> [generate frames]
```

## Shared Dependencies

- `@/components/ActionButton` -- primary action buttons
- `@/components/PlaceholderCard` -- gradient placeholder with aspect ratio
- `@/lib/hooks/useGenerationResults` -- tracks FAL generation status via realtime + polling
- `@/features/ai-images/server/fal-params.server` -- buildFalInput() for FAL submissions
- `@/features/credits/server/check-credits.server` -- credit gating
- `@/lib/server/ai.server` -- AI model instances
