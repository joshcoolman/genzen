# Canvas

Spatial moodboard with infinite pan-and-zoom canvas for organizing images. Supports grouping, masonry layout, AI generation, image combination/remixing, and IndexedDB persistence for layout state.

## Architecture: DB is source of truth for membership, IndexedDB caches layout

All canvas images are `user_images` rows (S3 storage via `createImageStorage()`). The DB is authoritative for **which** images are on the canvas via the `on_canvas` flag; IndexedDB is a best-effort cache for **where** they sit (positions, groups, transform) plus `recordId`/`storagePath` per image -- never image data. This mirrors why Images survives restarts: a canvas image _is_ the same `user_images` row.

On every canvas mount, a reconcile pass (`InfiniteCanvas.tsx`) queries `on_canvas = true` rows and: reclaims any the local cache lost (a missed write, a generation that finished while away, a wiped cache -- completed ones placed via masonry, pending/queued ones resumed), and prunes cached images whose row is genuinely deleted. So anything the DB says is on the canvas always comes back, even if IndexedDB is stale.

**Image lifecycle:**

1. Paste/drop/upload -> file uploaded to S3 via `useUserImages.create()` -> `recordId` + `storagePath` stored in canvas state; `setOnCanvas(true)` fired eagerly
2. Library pick -> existing `recordId` + `storagePath`; `setOnCanvas(true)` eagerly
3. AI generation -> pending placeholder (persisted with `recordId`) -> poll for completion. Rows are tagged `on_canvas = true` **at the server insert** (`onCanvas` flag through `generateImage`), so a generation is reclaimable even if the client navigates/refreshes before it finishes. They also carry `origin = 'canvas'` (#207) -- the canvas authored the request, so it is the origin. That column replaced `generation_metadata.source_client`, which was written here and read nowhere
4. Image combination -> same as generation, multiple source images + prompt
5. Display -> R2 public URL fetched on canvas load (no expiry, not persisted)
6. Remove-from-canvas -> `setOnCanvas(false)` eagerly (the row is _not_ deleted; it stays in the library)

**Key type:**

```ts
interface CanvasImage {
  id: string // canvas-local UUID
  recordId: string // user_images.id (required)
  storagePath: string // S3 storage path (persisted)
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

- `InfiniteCanvas.tsx` -- main canvas component (~1243 lines): pan/zoom, drag-move, marquee selection, grouping, undo/redo, paste/drop (upload to S3), context menu, library picker
- `SelectionActions.tsx` -- fixed bottom toolbar: upload, library, arrange, group/ungroup, zoom display
- `CanvasGenerateDialog.tsx` -- dialog wrapping `GeneratorPanel` from ai-images; overrides `handleGenerate` with optimistic placeholder flow. Handles both single-image and multi-image (group) generation.

## Generate flow (single + multi unified)

Generation is one flow keyed off the selection (`useCanvasGenerate`). The on-image Generate pill appears below the selection for 1..`CANVAS_MAX_GROUP_SELECTION` non-pending images:

- **1 image** → it's the source (Image 1), single-image generate as before.
- **2..N images** → the first is the primary/source (Image 1, shown up top); the rest pre-fill the reference strip (Image 2..N) via `replaceRefImages`. Every image is auto-labeled `[Image 1, Image 2, ...]`, prepended to the prompt (`useGenerator`'s `promptPrefix`) so the model can be referenced by number with no UI labeling.
- The model selector is **scoped to models whose edit endpoint can hold the references** (`canvasModelIdsForRefCount` → `useModelSelector({ allowedIds })`); too-small models drop out so references can't be silently truncated. Over `CANVAS_MAX_GROUP_SELECTION` selected → no pill.

There is no separate "Combine" feature anymore (retired into this flow).

**Placement:** previews lay out to the right of the source; if that would overlap existing images they relocate to clear space below everything (single-image: the source moves with them; group: inputs stay put). The view `fitBounds`-zooms to the new previews. For a single-image generate the origin + its previews are auto-grouped (`groupImages`).

**Delete:** Delete/Backspace opens a confirm modal (Remove from Canvas / Move to Trash / Cancel); each shows an Undo toast. Right-click context menu offers the same Generate + Move to Trash.

## Hooks

- `use-canvas-generate.ts` -- `useCanvasGenerate()`: composes `useGenerator` + `useModelSelector` + `useCredits` + `useUserImages`. `open(selection)` takes the selected images (first = source, rest = references), scopes models by ref capacity, auto-labels images, creates optimistic placeholders, polls for completion. Pre-fills prompt from `generation_metadata` (single-image only).

## Lib

- `masonry.ts` -- `layoutMasonry()`: column-based masonry algorithm using median input width as default column width
- `persistence.ts` -- IndexedDB read/write + URL/dimension helpers, plus fail-safe wrappers over `server/canvas.actions.ts`: `getSignedUrl()` (R2 public URL), `resolveSignedUrls()`, `getImageDimensions()`, `getUrlDimensions()` (URL-based, for reclaimed images), `syncCanvasFlags()`, `setOnCanvas(ids, value)` (eager membership write), `fetchOnCanvasRecords()` (membership source of truth), `fetchDeadRecordIds(ids)` (deleted-row detection for safe pruning). The wrappers swallow failures on purpose: a reconcile that cannot reach the server must never prune a live image, and a failed membership write is reconciled on the next save. Save/load keep any image with a `recordId` (including in-flight pending placeholders); only `signedUrl` is stripped.

## Server

- `server/canvas.actions.ts` -- the canvas's database access, user-scoped by `resolveAuth()`: `listOnCanvasRecords`, `listDeadRecordIds`, `setImagesOnCanvas`, `trashCanvasImages`, `restoreCanvasImages`, `getCanvasGenerationRecord`, `getImagePrompt`. Membership and trash used to be id-only queries from the browser, so an id from anywhere flipped or trashed a row (#173).

## Shared Dependencies

- `#/features/ai-images/hooks/use-generator` -- prompt state, source image, generation submission
- `../_components/generator-panel/generator-panel` -- reused UI for generation controls
- `#/features/ai-images/server/generate-image.server` -- server action for multi-image combination
- `#/features/user-images/` -- `useUserImages` for upload
- `../_components/existing-image-picker/existing-image-picker` -- library picker
- `#/features/user-images/lib/file-hash` -- `computeFileHash` for dedup on upload
- `#/lib/server/check-pending-generations.server` -- triggers FAL status checks

## Quirks / Notes

- All layout state persists to IndexedDB, debounced at 500ms, and flushed on unmount + `pagehide`/`visibilitychange`. Image data lives in Postgres and S3 only.
- IndexedDB save/load keep any image with a `recordId` -- including pending generation placeholders (recordId set, no `storagePath` yet) so in-flight work survives navigation/refresh. Only `signedUrl` (runtime) is stripped; the `pending` flag is retained so mount-time recovery knows to resume polling. Images without a `recordId` (old `src`-data-URL format, or a placeholder before its record returns) are dropped.
- IndexedDB persistence on `pagehide` is best-effort (async writes may not commit on unload); the mount reconcile against `on_canvas` rows is the real durability backstop.
- Generation polling uses one shared interval per hook that drains accumulated record refs, so concurrent batches (or a fresh submit during a mount-time resume) don't drop each other's tracking.
- Image URLs are R2 public URLs (no expiry); re-fetched on canvas load via `resolveSignedUrls()` (legacy name)
- High-frequency events (drag, wheel) update refs directly to avoid React re-renders
- Undo/redo stack capped at 50 entries
- Zoom range: 0.02 to 1.0 scale (default 0.5)
- Paste/drop uploads files to S3 immediately, shows pending placeholders with correct dimensions
- Combine feature requires 2-4 selected images; supports 1-2 run iterations per model
- `syncCanvasFlags()` reconciles the `on_canvas` boolean on `user_images` on each debounced save (diff-based); `setOnCanvas()` writes it eagerly the moment an image joins/leaves the canvas so the DB is accurate for recovery before the next save
