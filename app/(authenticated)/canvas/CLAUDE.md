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

1. Paste / drop / upload -> `saveFileToLibrary` (via `useUserImages.create()`)
   -> `addToCanvas` with the placeholder's position, eagerly
2. Library pick, or a paste of an image copied from the Cmd-F overlay
   (`addImageByRecordId`, #213) -> `addToCanvas` with the masonry position,
   eagerly. Neither uploads: the row already exists, and only membership is new
3. AI generation -> the `canvas_images` row is written _at the insert_
   (`createPendingGeneration`'s `onCanvas`), unplaced; the client places it on
   load. Rows also carry `origin = 'canvas'` (#207) -- the canvas authored the
   request
4. Display -> a `/img/[id]` URL from `#/lib/image-url`, resolved server-side by
   `loadCanvasState()`. The bucket is private (#226); nothing reads an object
   address
5. Move to Trash -> `deleted_at` only; membership survives, so restoring from
   Trash returns the card to its coordinates. **The only way a card leaves.**
   Remove-from-canvas was the other one and #236 deleted it: it destroyed the
   arrangement with no way back, which made it the single exception to "if it
   can be undone, do it; if it cannot, ask". `removeFromCanvas()` still exists
   and is used by one caller -- dismissing a failed tile, which never became an
   image

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
  pending?: boolean // derived from user_images.status -- nothing to draw yet
  uploading?: boolean // drawn from local bytes; the row has not returned
  signedUrl?: string // a /img/[id] URL (legacy name; nothing is signed), or a local object URL
}
```

## Shape

The route has the standard shape (`docs/reference/route-shape.md`): `page.tsx`
reads on the server, `view.tsx` composes and carries no styles, `use-view.ts`
holds the state. #189 split the 1698-line `infinite-canvas.tsx` into that,
plus `_hooks/` and one folder per component; the file and its 412-line
stylesheet are gone.

**Two coordinate systems meet at `canvas-surface`, and which one a thing
belongs to is the load-bearing decision.** Its `plane` prop renders inside the
transform, in canvas coordinates, and scales with the zoom -- cards and group
slabs. Its `children` render over the plane in screen coordinates at a fixed
size -- model labels, pending spinners, the selection box, the Generate pill,
the marquee. Anything that must stay legible when zoomed out is a child.

## Components

Each owns its own `.module.css`. `canvas-surface` is the frame (fixed
full-bleed surface, pan cursor, the transformed plane) -- a named component
rather than a module on the view, the same call route-shape records for
Login's `centered-panel`.

- `canvas-surface` -- the frame and the plane/overlay boundary above
- `image-card` -- one card, in one of three states: pending, failed, image
- `group-background` -- the slab behind a group; carries `data-group-id`
- `model-label`, `pending-overlay`, `selection-bounds`, `generate-pill`,
  `marquee-box` -- the screen-space overlays
- `empty-prompt` -- the nothing-here-yet copy (teaches the interaction model,
  which is why it is not `EmptyState`)
- `context-menu`, `drop-notice`
- `selection-actions` -- fixed bottom toolbar: upload, library, arrange,
  group/ungroup, zoom display
- `canvas-generate-dialog` -- wraps `GeneratorPanel` from ai-images; overrides
  `handleGenerate` with the optimistic placeholder flow, single and group

## Generate flow (single + multi unified)

Generation is one flow keyed off the selection (`useCanvasGenerate`). The on-image Generate pill appears below the selection for 1..`CANVAS_MAX_GROUP_SELECTION` non-pending images:

- **1 image** → it's the source (Image 1), single-image generate as before.
- **2..N images** → the first is the primary/source (Image 1, shown up top); the rest pre-fill the reference strip (Image 2..N) via `replaceRefImages`. Every image is auto-labeled `[Image 1, Image 2, ...]`, prepended to the prompt (`useGenerator`'s `promptPrefix`) so the model can be referenced by number with no UI labeling.
- The model selector is **scoped to models whose edit endpoint can hold the references** (`canvasModelIdsForRefCount` → `useModelSelector({ allowedIds })`); too-small models drop out so references can't be silently truncated. Over `CANVAS_MAX_GROUP_SELECTION` selected → no pill.

There is no separate "Combine" feature anymore (retired into this flow).

**Placement:** previews lay out to the right of the source; if that would overlap existing images they relocate to clear space below everything (single-image: the source moves with them; group: inputs stay put). The view `fitBounds`-zooms to the new previews. For a single-image generate the origin + its previews are auto-grouped (`groupImages`).

**Delete:** Delete/Backspace moves the selection to Trash. No modal, no toast, nothing to dismiss (#236) -- Trash is a place you can visit tomorrow, and that is the confirmation. Right-click context menu offers Generate + Move to Trash. A failure still speaks: the cards have already left the screen, so silence there would be a lie.

## Hooks

`_hooks/` holds one hook per concern; `use-view.ts` composes them and owns only
the shared image/group state plus the pointer handlers that arbitrate between
them.

- `use-viewport.ts` -- transform, screen<->canvas conversion, zoom/fit/focus,
  wheel zoom, space-to-pan. Owns `tRef`.
- `use-canvas-selection.ts` -- selection, marquee, and the group operations. Owns
  `sRef`. **Change the selection only through `select()`** -- it writes the
  state and the ref together, and twelve hand-written pairs of those is what
  #189 replaced.
- `use-history.ts` -- undo/redo stacks, capped at 50.
- `use-ingest.ts` -- paste, drop, file picker, library picker.
- `use-removal.ts` -- move-to-trash, and dismissing a failed tile.
- `use-reconcile.ts` -- place-what-is-unplaced, once per mount.
- `use-autosave.ts` -- the 500ms debounce and its unload flush.
- `use-canvas-hotkeys.ts` -- the thirteen bindings.

- `use-canvas-generate.ts` -- `useCanvasGenerate()`: composes `useGenerator` + `useModelSelector` + `useUserImages`. `open(selection)` takes the selected images (first = source, rest = references), scopes models by ref capacity, auto-labels images, creates optimistic placeholders, polls for completion. Pre-fills prompt from `generation_metadata` (single-image only).

## Lib

- `geometry.ts` -- `getBounds`, `spatialSort`, `scaleToFit`, `centerOn` and the
  zoom range. Pure and unit-tested.
- `types.ts` -- `CanvasImage`, `Transform`, `CanvasGroup`, `DragMode`
- `masonry.ts` -- `layoutMasonry()`: column-based masonry algorithm using median input width as default column width
- `persistence.ts` -- the pure mapping between a membership row and a card
  (`memberToImage`, `stateToImages`, `groupsForSave`, `positionsForSave`) plus
  fail-safe wrappers over `_actions/canvas.ts`: `saveCanvas()`, `addToCanvas()`,
  `removeFromCanvas()`, `moveToTrash()`, `readLocalImage()`, `preloadUrl()`,
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
  `getCanvasGenerationRecord`, `getImagePrompt`. There is no un-trash here:
  restoring is Trash's own `restoreImages` (#236 deleted the canvas copy along
  with the Undo toast that was its only caller).
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
- Image URLs are `/img/[id]` -- app-served and session-checked since #226, not
  bucket URLs. `loadCanvasState()` derives them with `imageUrl()`; `getSignedUrl()`
  is gone and the `signedUrl` field name is a leftover.
- High-frequency events (drag, wheel) update refs directly to avoid React
  re-renders
- Undo/redo stack capped at 50 entries, and it is **local only**: it rewinds
  positions and groupings, nothing else. It has never touched `deleted_at` or
  membership, which is why the toast Undos that did could be deleted whole in
  #236 without the stack noticing. **Keep it that way.** #194 was the shape of
  the bug when something server-side leaned on `undo()`: cards came back on
  screen, the rows stayed deleted, and the next load dropped them for good --
  it looked like it worked. Anything that writes to the database and wants to be
  reversible must reverse its own write, or leave the recovery to Trash
- Zoom range: 0.02 to 1.0 scale (default 0.5)
- **A paste draws before it uploads.** The clipboard hands over the bytes, so
  the card renders from a local object URL at ~30ms, at its real dimensions and
  in its final position, and the upload runs underneath it. `uploading` is a
  separate flag from `pending` on purpose: `pending` means there is genuinely
  nothing to draw (a generation in flight) and gets the spinner; `uploading`
  means the picture is already there and only the row is missing, so it gets
  0.72 opacity and no pill. On settle the hosted URL is decoded before the
  `src` swap (`preloadUrl`), or the card blinks empty exactly as it finishes.
  Placing something spatially and watching a grey box is the version that felt
  wrong
