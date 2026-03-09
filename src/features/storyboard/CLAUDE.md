Storyboard feature -- story to visual references to 14 scene sketches with editable prompts and frame placeholders (currently mock/UI-only).

## Key Files

- `index.ts` -- barrel exports
- `hooks/useStoryboardPage.ts` -- state machine for 3-step flow (write, references, scenes); mock data for refined story, 8 references, 14 scene prompts
- `components/StoryboardPageContent.tsx` -- step routing
- `components/StoryInput.tsx` -- story textarea with "Refine Story" and "Generate References" buttons
- `components/ReferenceBoard.tsx` -- categorized reference grid (Characters, Objects, Environments) with "Generate Scenes" action
- `components/ReferenceCard.tsx` -- PlaceholderCard with RemoveButton, loading overlay, and inline edit input
- `components/SceneList.tsx` -- 14-row scene grid with reference summary pills and "Generate All Frames" action
- `components/SceneRow.tsx` -- prompt textarea (left) + PlaceholderCard frame (right) + regenerate button

## Route

`src/routes/dashboard/storyboard.tsx`

## Flow

```
write → [refine story] → references → [edit references] → scenes
```

## Shared Dependencies

- `@/components/ActionButton` -- primary action buttons
- `@/components/PlaceholderCard` -- gradient placeholder with aspect ratio + label
- `@/components/RemoveButton` -- destructive X button for removing items
- `@/lib/constants/mock-gradients` -- shared gradient array for placeholders

## Quirks / Notes

- Fully mocked -- all generation uses setTimeout, frames are gradient placeholders
- Sample story pre-populated for immediate testing
- "Refine Story" replaces text with a polished mock version
- References require >= 1 per category (character, object, environment) to proceed to scenes
- Each reference can be edited (shows loading then appends "(edited)") or removed
- "Back to story" preserves story text but clears references
