# Canvas

Spatial moodboard with infinite pan-and-zoom canvas for organizing images. Supports grouping, masonry layout, AI variation generation, and IndexedDB persistence.

## Key Files

- `types.ts` -- `CanvasImage`, `Transform`, `CanvasGroup`, `PersistedState`, `DragMode` types
- `index.ts` -- barrel export of `InfiniteCanvas` component

## Components

- `InfiniteCanvas.tsx` -- main canvas component (~1200 lines): pan/zoom, drag-move, marquee selection, grouping, undo/redo, paste/drop, context menu, library picker
- `SelectionActions.tsx` -- fixed bottom toolbar shown when images are selected: upload, library, arrange, group/ungroup, zoom display
- `CanvasVariationsDialog.tsx` -- modal for generating image variations: model select (from `EDIT_MODELS`), aspect ratio presets, count (1-4), optional prompt. Persists preferences to localStorage

## Hooks

- `use-canvas-variations.ts` -- `useCanvasVariations()`: creates placeholder images, calls `canvasGenerate`, polls `user_images` table every 5s for completion, downloads signed URLs from Supabase storage, converts to data URLs

## Lib

- `masonry.ts` -- `layoutMasonry()`: column-based masonry algorithm. Column width = median of input widths. Params: items, columns, originX, originY, colWidth?, gap (default 16)
- `persistence.ts` -- IndexedDB read/write ("moodboard" DB, "state" store), `fileToDataUrl()` utility

## Server

- `canvas-generate.server.ts` -- `canvasGenerate` server function: auth check, credit deduction, auto-describes image via vision if no prompt, generates variation directives via Claude, submits to FAL or Google (Imagen) based on model provider, creates `user_images` records with pending status

## Shared Dependencies

- `@/features/ai-images/models` -- `EDIT_MODELS` for variation model selection
- `@/features/credits/` -- credit checking and deduction
- `@/features/user-images/` -- `ExistingImagePicker` for library image selection
- `@/lib/server/auth.server.ts` -- `requireAuth()`
- `@/lib/server/ai.server.ts` -- Claude model instances for vision/variation prompts
- `@/lib/prompts/image-variation.ts` -- `IMAGE_VARIATION_SYSTEM` prompt

## Quirks / Notes

- All canvas state (images, transform, groups) persists to IndexedDB, debounced at 500ms
- High-frequency events (drag, wheel) update refs directly to avoid React re-renders -- `tRef`, `iRef`, `sRef`, `gRef` mirror state
- Undo/redo stack capped at 50 entries, stored in refs
- Zoom range: 0.02 to 1.0 scale
- Marquee selection uses pointer capture for smooth cross-boundary drags
- Clicking a grouped image selects the whole group; shift+click toggles individual images
- Variation placeholders show pulsing animation; replaced with real images on completion or removed on failure
- Images stored as data URLs (no Supabase storage for canvas state itself)
- `InfiniteCanvas.tsx` is large (~1200 lines) -- candidate for refactoring into smaller hooks
