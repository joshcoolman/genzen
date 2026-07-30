# Canvas

Spatial moodboard: infinite pan-and-zoom canvas for arranging images, with
grouping, masonry layout, and AI generation from the selection.

## Architecture: a canvas is a container (#212)

`canvases` holds the viewport and the groupings; `canvas_images` holds
**membership and position**, one row per card, with foreign keys to both the
canvas and the image. Arrangement is user data and lives in Postgres, so it
survives a different browser and a different machine. There is no IndexedDB and
no `on_canvas` boolean -- both are gone.

**The library owns everything.** A membership row is an _arrangement over a
library image_, never exile: nothing exists only inside a canvas. So trashing is
a library operation that leaves membership alone -- the read filters
`deleted_at`, the card stops rendering, and a restore puts it back at the same
coordinates. `deleted_at = now(), on_canvas = false` was the bug this replaced.

**One reconcile rule: place what is unplaced.** A membership row may arrive with
no position, because a generation's row is written server-side the moment it is
reserved -- which is what makes it reclaimable if the client navigates away
before FAL answers. Nothing else needs reconciling, and that is structural
rather than tidy: reclaim is meaningless (the rows _are_ the membership), prune
is impossible (`on delete cascade`), dedupe is impossible
(`unique (canvas_id, image_id)`).

`page.tsx` reads on the server and seeds the view, so there is no loading gate
and no empty first paint. A save writes positions, viewport and groupings and
**never** membership -- otherwise a client that had not heard about a new
generation could evict it.

**Image lifecycle:**

1. Paste / drop / upload -> file to S3 via `useUserImages.create()` ->
   `addToCanvas` with the placeholder's position, eagerly
2. Library pick -> `addToCanvas` with the masonry position, eagerly
3. AI generation -> the `canvas_images` row is written _at the insert_
   (`createPendingGeneration`'s `onCanvas`), unplaced; the client places it on
   load. Rows also carry `origin = 'canvas'` (#207) -- the canvas authored the
   request
4. Display -> the public R2 URL, resolved server-side by `loadCanvasState()`
5. Remove from canvas -> the membership row is deleted; the image is untouched
   in the library
6. Move to Trash -> `deleted_at` only; membership survives so Undo restores the
   card in place

**Key type:**

```ts
interface CanvasImage {
  id: string // = recordId, from `unique (canvas_id, image_id)`
  recordId: string // user_images.id (required)
  storagePath: string // S3 storage path
  x
  y
  width
  height
  pending?: boolean // derived from user_images.status
  signedUrl?: string // the public URL (legacy name)
}
```

## Key Files

- `types.ts` -- `CanvasImage`, `Transform`, `CanvasGroup`, `DragMode`
- `index.ts` -- barrel export of `InfiniteCanvas` component

## Components

- `infinite-canvas.tsx` -- main canvas component (~1750 lines; the view/hook split is #189): pan/zoom, drag-move, marquee selection, grouping, undo/redo, paste/drop (upload to S3), context menu, library picker
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
- `persistence.ts` -- the pure mapping between a membership row and a card
  (`memberToImage`, `stateToImages`, `groupsForSave`, `positionsForSave`) plus
  fail-safe wrappers over `_actions/canvas.ts`: `saveCanvas()`, `addToCanvas()`,
  `removeFromCanvas()`, `moveToTrash()`, `restoreFromTrash()`, `getSignedUrl()`,
  `getImageDimensions()`, `getUrlDimensions()`. The wrappers swallow failures on
  purpose: a write that cannot reach the server must never take a card off the
  screen. `groupsForSave` is the one non-obvious piece -- a group formed over
  freshly-uploaded cards still holds local placeholder ids, and saving those
  would name images that do not exist on the next load.

## Server

- `_actions/canvas.ts` -- the canvas's database access, user-scoped by
  `resolveAuth()`: `loadCanvasState` (the whole canvas, read by `page.tsx`),
  `saveCanvasState` (positions / viewport / groupings, never membership),
  `addImagesToCanvas`, `removeImagesFromCanvas`, `trashCanvasImages`,
  `restoreCanvasImages`, `getCanvasGenerationRecord`, `getImagePrompt`.
  Membership and trash used to be id-only queries from the browser, so an id
  from anywhere flipped or trashed a row (#173).
- `#/lib/server/canvas-membership.server.ts` -- `ensureDefaultCanvas`,
  `addCanvasMembers`, `removeCanvasMembers`, `listCanvasMemberIds`. Shared,
  because the generation insert path writes membership too. One canvas per user
  today; `canvases.id` is the seam for more.

## Shared Dependencies

- `#/features/ai-images/hooks/use-generator` -- prompt state, source image, generation submission
- `../_components/generator-panel/generator-panel` -- reused UI for generation controls
- `#/features/ai-images/server/generate-image.server` -- server action for multi-image combination
- `#/features/user-images/` -- `useUserImages` for upload
- `../_components/existing-image-picker/existing-image-picker` -- library picker
- `#/features/user-images/lib/file-hash` -- `computeFileHash` for dedup on upload
- `#/lib/server/check-pending-generations.server` -- triggers FAL status checks

## Quirks / Notes

- Arrangement saves to Postgres, debounced at 500ms, and flushes on unmount +
  `pagehide`/`visibilitychange`. Best-effort on unload -- but nothing is cached
  locally, so the worst case is losing the last drag, not the arrangement.
- A card's `id` **is** its `user_images.id`, which is only sound because of
  `unique (canvas_id, image_id)`. That is what keeps a card's identity stable
  across loads, so a saved group still names the right images.
- Generation polling uses one shared interval per hook that drains accumulated
  record refs, so concurrent batches (or a fresh submit during a mount-time
  resume) don't drop each other's tracking.
- Image URLs are R2 public URLs (no expiry), resolved server-side in
  `loadCanvasState()`. `signedUrl` and `getSignedUrl()` are legacy names.
- High-frequency events (drag, wheel) update refs directly to avoid React
  re-renders
- Undo/redo stack capped at 50 entries. **Undo does not reverse the server
  write** -- #194, downstream of #212
- Zoom range: 0.02 to 1.0 scale (default 0.5)
- Paste/drop uploads files to S3 immediately, shows pending placeholders with
  correct dimensions. Canvas paste reaches the upload path that skips
  `createThumbnail` -- #215
