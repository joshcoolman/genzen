# Continue: History Page + Prompt Studio DB Migration

## What was worked on

Planning session -- no code changes. Explored the entire codebase to inventory all prompt/history/memory systems, then designed a "compounding value" initiative. User narrowed to two concrete deliverables after reviewing FAL's history UI as reference.

## Key decisions

### 1. History Page (must-have, build first)

- New "History" route in the sidebar nav
- Two view modes: **list view** (FAL-style vertical feed) and **grid view** (card grid with thumbnails)
- Each entry shows: thumbnail, prompt text, model name, elapsed generation time, relative timestamp
- **Searchable** by prompt text (start with `ILIKE` on `generation_metadata->>'prompt'`)
- Actions per entry: "Copy prompt", "Use again" (populates generator)
- Data source: `user_images` table, `generation_metadata` JSONB -- all data already exists, no new tables needed
- Reverse chronological, completed generations only (`status = 'completed'`)
- Reference UI: FAL's `fal.ai/dashboard/recent-history` (user provided screenshots -- list and grid views)
- Follow composable feature pattern: Route -> Hook -> PageContent

### 2. Prompt Studio Sets -> Supabase (must-have)

- Currently `prompt-studio-sets` in localStorage -- device-bound, fragile
- Migrate to a new Supabase table (similar to `user_prompts` or `notes`)
- Sets contain: name, prompt, systemPrompt, negativePrompt, selected model IDs
- Key files: `src/features/prompt-studio/hooks/usePromptSets.ts`, `src/features/prompt-studio/types.ts`

### 3. AD Context Awareness (stretch goal, not for this session)

- Give AD access to current page state so user doesn't have to copy/paste screenshots or text
- Could extend existing `useRegisterADContext` pattern to inject richer feature state
- Or: automated screenshot capture for AD vision
- User noted the manual workflow (copy prompt, paste into AD) works well but has friction

## Existing infrastructure (from codebase exploration)

- **Prompts stored in**: `generation_metadata.prompt` (per image, JSONB), `user_prompts` table (curated library), localStorage (Prompt Studio session)
- **Image lineage**: `source_image_id` (immutable edit source), `root_image_id` (variation ancestor), `parent_id` (mutable org grouping)
- **AD chat**: localStorage only, 50 msg cap, no cross-session memory
- **Notes**: Supabase `notes` table, markdown snapshots of AD chats
- **Persistence hooks**: `use-persisted-state.ts` (localStorage), `use-persisted-blob.ts` (IndexedDB)
- **No search exists** for images by prompt text currently
- **No mem0 or memory system** exists

## Outstanding work

Everything -- this was planning only. Next session should:

1. Create feature branch
2. Build the History feature (`src/features/history/`)
3. Add server function to query `user_images` with prompt search
4. Build list + grid view components
5. Add nav item to sidebar
6. Then tackle Prompt Studio sets -> Supabase migration

## Unstaged changes

11 file deletions (old review docs, moved claude configs) -- unrelated cleanup, not part of this initiative. Should be committed or discarded separately.

## Git state

- Branch: `main`
- Last commit: `d21a239 fix: prompt-studio UX -- layout reorder, collapsible system prompt, timeout fix`
- Working tree has unstaged deletions of old files (cleanup from prior sessions)
- No new code written yet for history/memory features
