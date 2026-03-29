# Canvas

Spatial moodboard with infinite pan-and-zoom canvas for organizing images. Supports grouping, masonry layout, AI generation, image combination/remixing, and IndexedDB persistence for layout state.

## Architecture: Supabase-Backed Images

All canvas images are stored in R2 (`user_images` table + R2 storage via `createImageStorage()`). Canvas state in IndexedDB only stores layout data (positions, groups, transform) plus `recordId` and `storagePath` per image -- never image data.

**Image lifecycle:**

1. Paste/drop/upload -> file uploaded to Supabase via `useUserImages.create()` -> `recordId` + `storagePath` stored in canvas state
2. Library pick -> existing `recordId` + `storagePath` from `user_images` record
3. AI generation -> pending placeholder -> poll for completion -> `recordId` + `storagePath` on success
4. Image combination -> multiple source images + prompt -> pending placeholders -> poll -> `recordId` + `storagePath` on success
5. Display -> R2 public URL fetched on canvas load (no expiry, not persisted)

**Key type:**

```ts
interface CanvasImage {
  id: string // canvas-local UUID
  recordId: string // user_images.id (required)
  storagePath: string // Supabase storage path (persisted)
  x
  y
  width
  height
  pending?: boolean // true during upload/generation
  signedUrl?: string // runtime only, not persisted
}
```

## Key Files

- `types.ts` -- `CanvasImage`, `Transform`, `CanvasGroup`, `PersistedState`, `DragMode`
- `index.ts` -- barrel export of `InfiniteCanvas` component

## Components

- `InfiniteCanvas.tsx` -- main canvas component (~1243 lines): pan/zoom, drag-move, marquee selection, grouping, undo/redo, paste/drop (upload to Supabase), context menu, library picker
- `SelectionActions.tsx` -- fixed bottom toolbar: upload, library, arrange, group/ungroup, generate (1 image), combine (2-4 images), zoom display
- `CanvasGenerateDialog.tsx` -- dialog wrapping `GeneratorPanel` from ai-images; overrides `handleGenerate` with optimistic placeholder flow
- `CanvasCombineDialog.tsx` -- dialog for multi-image combination/remixing: thumbnail grid with labels, aspect ratio/orientation, prompt, model toggles (FLUX 2 Pro, Nano Banana 2), run counter

## Hooks

- `use-canvas-generate.ts` -- `useCanvasGenerate()`: composes `useGenerator` + `useModelSelector` + `useCredits` + `useUserImages`. Creates optimistic placeholders, polls for completion, uses R2 public URLs for source images. Pre-fills prompt from `generation_metadata`.
- `use-canvas-combine.ts` -- `useCanvasCombine()`: manages multi-image combination state (sourceImages, labels, prompt, aspectRatio, runsCount). Supports FLUX 2 Pro and Nano Banana 2 models. Cost: `CREDIT_COSTS.variation * (models.length * runsCount)`.

## Lib

- `masonry.ts` -- `layoutMasonry()`: column-based masonry algorithm using median input width as default column width
- `persistence.ts` -- IndexedDB read/write, `getSignedUrl()` (now R2 public URL), `resolveSignedUrls()`, `getImageDimensions()`, `syncCanvasFlags()`. Strips `signedUrl`/`pending` before save, filters old-format images on load.

## Shared Dependencies

- `@/features/ai-images/hooks/use-generator` -- prompt state, source image, generation submission
- `@/features/ai-images/components/GeneratorPanel` -- reused UI for generation controls
- `@/features/ai-images/server/generate-image.server` -- server action for multi-image combination
- `@/features/user-images/` -- `useUserImages` for upload, `ExistingImagePicker` for library
- `@/features/user-images/lib/file-hash` -- `computeFileHash` for dedup on upload
- `@/features/credits/` -- credit checking and deduction
- `@/lib/server/check-pending-generations.server` -- triggers FAL status checks

## Quirks / Notes

- All layout state persists to IndexedDB, debounced at 500ms. Image data lives in Supabase only.
- Pending images (empty `recordId`) and `signedUrl` fields are stripped before IndexedDB save
- Old-format images (with `src` data URLs, no `recordId`) are filtered out on load (migration)
- Image URLs are R2 public URLs (no expiry); re-fetched on canvas load via `resolveSignedUrls()` (legacy name)
- High-frequency events (drag, wheel) update refs directly to avoid React re-renders
- Undo/redo stack capped at 50 entries
- Zoom range: 0.02 to 1.0 scale (default 0.5)
- Paste/drop uploads files to Supabase immediately, shows pending placeholders with correct dimensions
- Combine feature requires 2-4 selected images; supports 1-2 run iterations per model
- `syncCanvasFlags()` updates `on_canvas` boolean on `user_images` table asynchronously
