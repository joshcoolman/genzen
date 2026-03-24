# Canvas

Spatial moodboard with infinite pan-and-zoom canvas for organizing images. Supports grouping, masonry layout, AI generation via shared AI Images pipeline, and IndexedDB persistence for layout state.

## Architecture: Supabase-Backed Images

All canvas images are stored in Supabase (`user_images` table + `user-images` storage bucket). Canvas state in IndexedDB only stores layout data (positions, groups, transform) plus `recordId` and `storagePath` per image -- never image data.

**Image lifecycle:**

1. Paste/drop/upload -> file uploaded to Supabase via `useUserImages.create()` -> `recordId` + `storagePath` stored in canvas state
2. Library pick -> existing `recordId` + `storagePath` from `user_images` record
3. AI generation -> pending placeholder -> poll for completion -> `recordId` + `storagePath` on success
4. Display -> full-res signed URL fetched on canvas load (24h TTL, not persisted)

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

- `InfiniteCanvas.tsx` -- main canvas component (~1100 lines): pan/zoom, drag-move, marquee selection, grouping, undo/redo, paste/drop (upload to Supabase), context menu, library picker
- `SelectionActions.tsx` -- fixed bottom toolbar: upload, library, arrange, group/ungroup, zoom, generate
- `CanvasGenerateDialog.tsx` -- dialog wrapping `GeneratorPanel` from ai-images; overrides `handleGenerate` with optimistic placeholder flow

## Hooks

- `use-canvas-generate.ts` -- `useCanvasGenerate()`: composes `useGenerator` + `useModelSelector` + `useCredits` + `useUserImages`. Creates optimistic placeholders, polls for completion, uses Supabase signed URLs for source images (CORS-safe). Pre-fills prompt from `generation_metadata`.

## Lib

- `masonry.ts` -- `layoutMasonry()`: column-based masonry algorithm
- `persistence.ts` -- IndexedDB read/write, `getSignedUrl()`, `resolveSignedUrls()`, `getImageDimensions()`. Strips `signedUrl`/`pending` before save, filters old-format images on load.

## Shared Dependencies

- `@/features/ai-images/hooks/use-generator` -- prompt state, source image, generation submission
- `@/features/ai-images/components/GeneratorPanel` -- reused UI for generation controls
- `@/features/user-images/` -- `useUserImages` for upload, `ExistingImagePicker` for library
- `@/features/user-images/lib/file-hash` -- `computeFileHash` for dedup on upload
- `@/features/credits/` -- credit checking and deduction
- `@/lib/server/check-pending-generations.server` -- triggers FAL status checks

## Quirks / Notes

- All layout state persists to IndexedDB, debounced at 500ms. Image data lives in Supabase only.
- Pending images (empty `recordId`) and `signedUrl` fields are stripped before IndexedDB save
- Old-format images (with `src` data URLs, no `recordId`) are filtered out on load (migration)
- Signed URLs expire after 24h; re-fetched on canvas load via `resolveSignedUrls()`
- High-frequency events (drag, wheel) update refs directly to avoid React re-renders
- Undo/redo stack capped at 50 entries
- Zoom range: 0.02 to 1.0 scale
- Paste/drop uploads files to Supabase immediately, shows pending placeholders with correct dimensions
- Library picker uses full-res signed URLs (no transforms), looks up `storagePath` from fetched `UserImage` records
