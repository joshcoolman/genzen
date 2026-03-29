## Overview

A spatial workspace where images can be freely positioned, grouped, and manipulated on an infinite canvas. Supports paste/drop upload, AI image generation, multi-image combination/remixing, masonry auto-layout, and undo/redo. Layout state persists to IndexedDB; image data lives in Supabase.

## How It Works

1. Images added via paste/drop (uploaded to Supabase), library picker, or AI generation
2. Canvas stores layout data (position, size, groups) in IndexedDB with `recordId` + `storagePath` per image
3. Signed URLs fetched on canvas load (24h TTL, not persisted)
4. High-frequency events (drag, wheel) update refs directly to avoid React re-renders
5. Undo/redo stack capped at 50 entries
6. Combine feature takes 2-4 selected images, runs them through FLUX 2 Pro or Nano Banana 2

## Usage

- Navigate to Canvas
- Paste/drop images or pick from library
- Drag to reposition, scroll to zoom (range: 0.02 to 1.0)
- Select multiple images with marquee, group/ungroup
- Use "Arrange" for automatic masonry layout
- Generate new images or combine selected images with AI

## Key Files

- `src/features/canvas/types.ts` -- CanvasImage, Transform, CanvasGroup, PersistedState, DragMode
- `src/features/canvas/components/InfiniteCanvas.tsx` -- Main canvas (~1243 lines): pan/zoom, drag, marquee select, grouping, paste/drop, context menu
- `src/features/canvas/components/SelectionActions.tsx` -- Bottom toolbar: upload, library, arrange, group/ungroup, generate, combine
- `src/features/canvas/components/CanvasGenerateDialog.tsx` -- AI generation dialog with optimistic placeholder flow
- `src/features/canvas/components/CanvasCombineDialog.tsx` -- Multi-image combination: 2-4 images, aspect ratio, model toggles
- `src/features/canvas/hooks/use-canvas-generate.ts` -- Generation with optimistic placeholders, polling, signed URLs
- `src/features/canvas/hooks/use-canvas-combine.ts` -- Multi-image combination state management
- `src/features/canvas/lib/masonry.ts` -- Column-based masonry layout algorithm
- `src/features/canvas/lib/persistence.ts` -- IndexedDB read/write, signed URL resolution

## Dependencies

- IndexedDB -- layout persistence (debounced 500ms)
- Supabase -- image storage and records
- `@/features/ai-images/` -- GeneratorPanel, useGenerator for AI generation
- `@/features/user-images/` -- upload, library picker
- `@/features/credits/` -- credit deduction

## Database

- `user_images` -- image records with `on_canvas` flag
- IndexedDB -- canvas layout state (positions, groups, transform)
