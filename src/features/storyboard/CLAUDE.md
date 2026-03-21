Storyboard feature -- linear pipeline: story prompt -> scene breakdown -> frame generation, with character management and video clip generation.

## Key Files

- `index.ts` -- barrel exports (StoryboardPage, useStoryboard)
- `types.ts` -- Scene, Storyboard, StoryboardCharacter, GeneratedFrame interfaces, StoryboardStatus
- `hooks/useStoryboard.ts` -- state management: story editing, scene generation, frame tracking, auto-save
- `hooks/useStoryboardADContext.ts` -- registers storyboard context with AD assistant
- `components/StoryboardPage.tsx` -- main page layout with progressive reveal
- `components/StoryPromptSection.tsx` -- story textarea with Refine + Generate Scenes buttons
- `components/SceneList.tsx` -- scene list with model selector + Generate All Frames
- `components/SceneCard.tsx` -- single scene: editable fields, frame image, generate button
- `components/CharacterPanel.tsx` -- character reference image management UI
- `components/VideoSection.tsx` -- clip generation and video display
- `components/TimelineStrip.tsx` -- sticky bottom thumbnail strip for scene navigation
- `server/refine-story.server.ts` -- Claude Haiku expands rough prompt into cinematic narrative
- `server/generate-scenes.server.ts` -- Claude Haiku breaks story into structured scenes (JSON)
- `server/generate-storyboard-frame.server.ts` -- FAL image generation per scene's visual_description
- `server/generate-character-ref.server.ts` -- character reference image generation
- `server/generate-storyboard-video.server.ts` -- clip/video generation from scenes (duration clamped 3-15s)
- `server/save-storyboard.server.ts` -- upsert storyboard to Supabase
- `server/load-storyboard.server.ts` -- load most recent or specific storyboard

## Route

`src/routes/dashboard/dev-workspace.storyboard.tsx`

## Data Model

- `storyboards` table: id, user_id, title, story_prompt, refined_story, scenes (JSONB), characters (JSONB), video_record_id, status, created_at, updated_at
- Status values: `draft`, `scenes_generated`, `generating_frames`, `generating_video`, `complete`
- Generated frames stored in `user_images` with `generation_type: 'storyboard_frame'`
- Scene JSONB fields: visual_description (doubles as image prompt), action, emotion, framing, camera, lighting, lens, angle, caption, characters, generation_notes, reference_images, image_id, image_url, generated_frames
- Characters: slug, name, description, reference_images (array with id+url)

## Flow

```
story prompt -> [refine] -> [generate scenes] -> edit scenes -> [generate frames] -> [generate video clips]
                                                  ↕ manage characters
```

## Shared Dependencies

- `@/components/ActionButton` -- primary action buttons
- `@/components/PlaceholderCard` -- gradient placeholder with aspect ratio
- `@/lib/hooks/useGenerationResults` -- tracks FAL generation status via realtime + polling
- `@/features/ai-images/server/fal-params.server` -- buildFalInput() for FAL submissions
- `@/features/credits/server/check-credits.server` -- credit gating
- `@/lib/server/ai.server` -- AI model instances
