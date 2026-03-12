# Continue: Storyboard Feature Rebuild

## What was being worked on

Complete rebuild of `src/features/storyboard/` from a clunky 3-tab flow (Story/Elements/Scenes with mostly mocked data) to a linear pipeline: story prompt -> scene breakdown -> frame generation.

## Changes made so far

**New files created:**

- `types.ts` — Scene and Storyboard interfaces, FRAME_MODELS constant
- `hooks/useStoryboard.ts` — single hook managing story editing, scene generation (Claude Haiku), frame generation (FAL), auto-save to Supabase, image URL resolution via realtime + polling
- `components/StoryboardPage.tsx` — main layout with progressive reveal (story section, then scenes, then timeline strip)
- `components/StoryPromptSection.tsx` — auto-growing textarea, Refine Story + Generate Scenes buttons
- `components/SceneCard.tsx` — editable visual_description/caption (auto-grow, text-xs text-muted-foreground), gray placeholder, per-scene Generate/Regenerate button
- `components/SceneList.tsx` — scene list with model selector dropdown + Generate All Frames
- `components/TimelineStrip.tsx` — sticky bottom thumbnail strip, gray placeholders (not gradients), click-to-scroll
- `server/generate-scenes.server.ts` — Claude Haiku structured JSON scene generation, respects duration hints in user prompt
- `server/generate-storyboard-frame.server.ts` — FAL queue submission per scene, stores in user_images with generation_type: 'storyboard_frame'
- `server/save-storyboard.server.ts` — upsert storyboard (scenes as JSONB)
- `server/load-storyboard.server.ts` — load most recent or by ID
- `supabase/migrations/20260311000000_storyboards.sql` — storyboards table with RLS, status check constraint, updated_at trigger

**Deleted (old 3-tab flow):**

- StoryboardTabs, ReferenceBoard, ReferenceCard, StoryInput, StoryboardPageContent, SceneRow
- useStoryboardPage hook (663 lines of mostly mock data)
- generate-style-frame, generate-story-frame, extract-story-elements server files

**Updated:**

- `index.ts` — exports StoryboardPage + useStoryboard
- `storyboard.tsx` route — uses new hook/component
- `CLAUDE.md` — updated feature docs

## Key decisions

- **No gradients on placeholders** — use plain gray `bg-muted` everywhere
- **Auto-grow textareas** — all textareas expand with content, no fixed rows with scrolling
- **Text style** — `text-xs text-muted-foreground` for textarea content to maximize space
- **User-facing copy** — lead users to just describe what happens, not use technical terms like "scene-by-scene" or specify durations. Placeholder: "What's the story? Just tell us what happens..."
- **Duration handling** — system prompt respects duration hints if present, but defaults to 8-12 scenes if not specified
- **JSONB for scenes** — scenes stored as JSONB in storyboards table, never queried independently
- **Reuses existing infra** — useGenerationResults for FAL polling, buildFalInput for params, credits system, refine-story server fn kept as-is

## Outstanding work

- **Migration not yet applied** — need `supabase db push` or `supabase migration up` before testing persistence
- **End-to-end testing** — the full flow (prompt -> refine -> generate scenes -> generate frames) needs live testing with Supabase + FAL
- **No "Open in Shots" action yet** — conceptual bridge to Shots feature for angle variations from hero frames
- **No storyboard list/picker** — currently loads most recent storyboard, no way to manage multiple storyboards
- **Save on scene generation** — first save needs to happen after scenes are generated (currently auto-saves require storyboardId to exist)

## Git state

- Branch: `story-board-refactor`
- Status: committed and pushed
