## Thumbnail Unification — Issue #65

**Branch:** `thumbnail-unification` (10 commits ahead of main, all pushed)

### What was done

Audited and unified thumbnail/card components across the codebase. Ten commits:

1. **Renamed `ImageResultCard` -> `Thumbnail`** (`src/components/Thumbnail.tsx`) as the composable base. Exported `ThumbnailProps` interface. Updated all 9 consumer files.

2. **Extracted shared utilities** that were duplicated 3x each:
   - `CopyButton` (`src/components/CopyButton.tsx`) — copy-to-clipboard with check icon feedback
   - `ExpandableText` (`src/components/ExpandableText.tsx`) — truncated text with click-to-expand + copy
   - `formatFileSize` (`src/lib/format.ts`)

3. **Replaced global "Show/Hide prompts" toggle** in AI Images gallery with per-card `ExpandableText`. Removed `hidePrompts` prop from `ImageCard` and `ImageGallery`. Each card always shows its prompt, truncated by default.

4. **Collapsed variations into parent card thumbnails.** `use-edit-children` already captured both edits AND variations via `source_image_id`. Added `childIds` set in `ImageGallery` to skip rendering completed images already shown as thumbnails on a parent. Pending/failed cards still render normally.

5. **Removed "More" button from gallery cards.** Variation generation is now exclusively in the edit view. Gallery card has only "Edit" button (full-width). Removed `MorePopover`, `generatingVariation`, `onPreviewVariations` props from `ImageCard`/`ImageGallery`. Variation hooks (`use-variations.ts`) untouched — still used by `ai-images.tsx` for the `VariationPromptsDialog`.

6. **Added "Generate Variations" button to focused edit view** (`FocusedEditView.tsx`). Between "Describe JSON" and "Generate Edit" in toolbar. Calls `generateVariationPrompts` (count=4), opens `VariationPromptsDialog`, then `submitVariations` with UI-selected aspect ratio and fixed `flux-pro/kontext` model. Adds pending results to the edit view's `GenerationResultsGrid` for optimistic feedback. Wired in `use-focused-edit.ts`.

7. **Optimistic pending cards for variations in edit view.** After `submitVariations` returns record IDs, pending results are added to the edit view's `GenerationResultsGrid` with spinners. Polling/realtime replaces them with completed images.

8. **Removed 8-item cap from `editChildrenMap`.** The cap was causing variations beyond the 8th to show as standalone gallery cards. All descendants now tracked in the map (for gallery filtering). Visual display in `ImageCard` shows all thumbnails — no cap for now.

9. **Enlarged edit thumbnails and tightened spacing.** Thumbs: `w-8 h-8` -> `w-10 h-10` (40px). Gap: `gap-1.5` -> `gap-1`. Padding: `px-3 pb-3` -> `px-1.5 pb-1.5`. Dropped "Edits" label. Fills card width better.

### Key decisions

- **Variations are edits** — no separate treatment in gallery. Both fold into parent thumbnails.
- **Per-card prompt UX** > global toggle. ExpandableText is the standard pattern everywhere.
- **Edit view is the focused workspace** for all derivative operations (edits + variations).
- **Gallery card is simplified** — just image, model badge, Edit button, prompt, and child thumbnails.
- **`use-edit-children` already had the right data** — filters by `source_image_id` which both edits and variations set. No hook changes needed for collapsing.
- **Promote-to-source flow** in edit view automatically makes "Generate Variations" reference the promoted image (uses `activeSourceId` + `sourceImage.prompt`).

### Outstanding / next steps

- **`use-variations.ts` + `VariationPromptsDialog` in `ai-images.tsx`** — still wired up on the AI Images page but the gallery no longer triggers it. Could clean up the dead code path if the dialog is never opened from that page anymore. Check if brainstorm or any other flow uses it.
- **`onLoadPrompt` / `onLoadPromptAndModel`** — declared on `ImageGalleryProps` but never used in the function body. Could be cleaned up.
- **"Edits" label** on parent card thumbnails — now includes variations too. Could rename to something more neutral or keep as-is.
- **Assets view** — intentionally left unchanged (flat chronological, no grouping).
- Pre-existing lint errors in `src/features/credits/handle-credit-error.ts` (2 `@typescript-eslint/no-unnecessary-condition` errors) — not from this work.

### Key files touched

- `src/components/Thumbnail.tsx` (was ImageResultCard)
- `src/components/CopyButton.tsx` (new)
- `src/components/ExpandableText.tsx` (new)
- `src/lib/format.ts` (new)
- `src/features/ai-images/components/ImageCard.tsx`
- `src/features/ai-images/components/ImageGallery.tsx`
- `src/features/ai-images/components/FocusedEditView.tsx`
- `src/features/ai-images/hooks/use-focused-edit.ts`
- `src/features/ai-images/hooks/use-edit-children.ts`
- `src/routes/dashboard/ai-images.tsx`
