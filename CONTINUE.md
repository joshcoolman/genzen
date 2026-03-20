# Continue: Unified Image Grid on `unified-thumbs`

## Branch: `unified-thumbs` -- all committed, pushed to origin (12 commits)

## What was worked on

Merged uploads into the AI Images grid, rebuilt generator sidebar, added parent/child management, descendant-aware sorting, and variation support for uploads.

## Key files changed

- `src/features/ai-images/hooks/use-images.ts` -- gallery queries, sort, delete variants, realtime
- `src/features/ai-images/hooks/use-focused-edit.ts` -- variation auto-describe for uploads
- `src/features/ai-images/hooks/use-ai-images-page.ts` -- exposed userId
- `src/features/ai-images/hooks/use-generator.ts` -- removed auto-caption, added manual handleCaption
- `src/features/ai-images/components/GeneratorPanel.tsx` -- sidebar layout, Describe/JSON buttons
- `src/features/ai-images/components/FocusedEditView.tsx` -- ModelFilterPills, variation button fix
- `src/features/ai-images/components/ImageGallery.tsx` -- removed display mode toggle
- `src/features/ai-images/server/reparent-image.server.ts` -- parent sort_order bump
- `src/routes/dashboard/ai-images.tsx` -- sidebar shell, upload/paste, delete dialog, overlay
- `src/components/ActionButton.tsx` -- outline variant polish
- `src/lib/hooks/useGenerationResults.ts` -- widened source filter

## Changes summary

- DB queries widened to `.in('source', ['upload', 'ai_generated'])` across gallery, edit BFS, generation results
- `sortByOrder` uses `max(own sort_order, newest descendant created_at)` -- runs on full set before filtering feature types
- Parent sort_order bumped on reparent (server) and realtime child INSERT (client + DB persist)
- Delete dialog: Keep all (detach children) / Keep children / Delete all -- with `deleteImageWithDescendants` and `deleteAndDetachChildren`
- Generator sidebar: pin/unpin, bg-black/90 backdrop-blur-2xl, invisible z-20 overlay for click-outside
- Manual Describe (prepends prompt) + JSON (appends) ActionButtons, no auto-caption
- Draft/Quality + count under Generate button, all controls h-9/36px composable baseline
- Uploads can Generate Variations via auto-describe (`captionImage`) when no prompt exists
- `ModelFilterPills` added below toolbar in focused edit view

## Outstanding work

### Variation children as mini-thumbs (next task)

Variations from edit view show as full-size "Generating..." cards in the main grid. Should appear as small loading thumbnails under the parent card instead. Requires:

1. `use-edit-children.ts` to include pending/variation children (currently only completed edits)
2. `ImageCard` to render pending mini-thumbs (pulsing skeleton) alongside completed ones
3. Add `'variation'` to the `FEATURE_TYPES` filter so variations are hidden as standalone grid cards
4. Consider renaming `editChildrenMap` to `childrenMap`

### Remove Assets page (agreed, not yet done)

Uploads now live in AI Images grid, making the Assets page redundant. Delete `src/routes/dashboard/assets.tsx` and its nav entry. Keep `src/features/user-images/` module -- its hooks are used by AI Images for upload/paste. Videos will get their own category later.

### Other potential follow-ups

- `editChildrenMap` typed as `Record<string, Array>` but undefined at runtime for missing keys -- needs proper null safety pattern
- Sidebar controls (TierToggle, NumberStepper) share h-9 baseline but could use ActionButton outline for even more consistency
