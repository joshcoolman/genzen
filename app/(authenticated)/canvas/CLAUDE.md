# Canvas

Spatial moodboard: infinite pan-and-zoom canvas for arranging images, with
grouping, masonry layout, and AI generation from the selection.

## Not in the nav, on purpose (2026-08-19)

Canvas is **unlisted**: its entry in `src/lib/nav-items.ts` is commented out,
and that entry was the only link to it anywhere, so the route is reachable only
by typing `/canvas`. Nothing about the route changed.

**It is in development, which is a third thing** -- not a finished part of the
app, and not a lab experiment either. The lab is for a small focused question
with an answer ("does seeking land on the frame you stopped on"). Canvas has no
such question; it works, and it is a place to try larger ideas in. Generating
from a multi-image selection is the one already worth having; multiple canvases
is the next thing to explore.

So the reason it left the rail is not that it is broken or unused-and-doomed.
Being a top-level destination made it read as finished, and an unfinished thing
in the main navigation pulls at you every time you see it -- Josh's words:
_"this isn't prime time, why is it a major part of the app?"_ Unlisted, it
stopped being a distraction and started being useful.

**It earns the rail back by being reached for often, and by nothing else.**
Deleting it is not the plan and was considered and rejected: the arguments for
removal were real (26 files outside this folder carry a canvas branch, two
tables, an `origin` value) and the answer was still no.

Two things follow for anyone working here:

- **Do not delete this folder or its tables** without Josh saying so directly.
- **Do not add it back to `nav-items.ts`** as a tidy-up. The absence is the
  decision.

## Architecture: a canvas is a container (#212)

`canvases` holds the viewport and the groupings; `canvas_images` holds
**membership and position**, one row per card, with foreign keys to both the
canvas and the image. Arrangement is user data and lives in Postgres, so it
survives a different browser and a different machine. There is no IndexedDB and
no `on_canvas` boolean -- both are gone.

**The canvas holds references, never originals.** A membership row is an
_arrangement over a library image_, never exile: every entry path -- paste,
drop, upload, library pick, generation -- writes a `user_images` row first, so
nothing exists only inside a canvas. That is what makes the board disposable:
taking a card off cannot lose a picture, only a position, and a position is a
byproduct of thinking rather than work worth a recovery path (#373). Groups hold
the durable structure; the canvas is where things are tried.

The canvas therefore does not reach into the library at all. It adds and removes
membership rows and nothing else -- no `deleted_at`, no `group_id`.

**And the library does not reach into the canvas** (#375). The member read has
no `deleted_at` filter: trashing an image to tidy a group leaves it on the board,
because Trash is a library state and the board is not the library. A card leaves
when it is taken off, and at no other time. What keeps that honest is Trash's
lock -- a row still holding membership cannot be permanently deleted, so nothing
can be destroyed out from under a canvas nobody is looking at. Remove it from the
canvas and the lock lifts.

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
2. Library pick -> `addToCanvas` with the masonry position, eagerly. It does
   not upload: the row already exists, and only membership is new. A paste of
   an image copied inside the app used to land here too (`addImageByRecordId`,
   #213); the clipboard no longer carries a record id, so pasting one uploads
   the bytes as a new row (#348)
3. AI generation -> the `canvas_images` row is written _at the insert_
   (`createPendingGeneration`'s `onCanvas`), unplaced; the client places it on
   load. Rows also carry `origin = 'canvas'` (#207) -- the canvas authored the
   request
4. Display -> a `/img/[id]` URL from `#/lib/image-url`, resolved server-side by
   `loadCanvasState()`. The bucket is private (#226); nothing reads an object
   address. Trashed images render like any other (#375)
5. Remove from canvas -> the `canvas_images` row goes, the `user_images` row
   is untouched. **The only way a card leaves.** It was replaced by a
   Move-to-Trash in #236 and came back in #373. #236's reasoning -- removal
   "destroyed the arrangement with no way back" -- belonged to a canvas whose
   arrangement was the only structure in the app. What the trash-instead bought
   was a canvas that soft-deleted library rows, cleared their `group_id` (#319),
   and left a membership row that made them permanently undeletable from Trash
   (#371)

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
  group/ungroup, zoom display. Takes the settings control as a `settings` slot
  rather than props, so the bar stays layout and never learns what a preference
  is
- `canvas-settings` -- the gear and its popover, left of the first divider with
  the other canvas-level controls. Its open state is lifted into `use-view` so
  it can feed `dialogOpenRef`: a popover is not a dialog, so without that Space
  still pans and Backspace still clears the board underneath it
- `canvas-generate-dialog` -- wraps `GeneratorPanel` from ai-images; overrides
  `handleGenerate` with the optimistic placeholder flow, single and group

## Generate flow (single + multi unified)

Generation is one flow keyed off the selection (`useCanvasGenerate`). The on-image Generate pill appears below the selection for 1..`CANVAS_MAX_GROUP_SELECTION` non-pending images:

- **1..N images** → the whole selection becomes the generator's set, in order, via `replaceRefImages`. There is no source slot to split it into since #297 -- canvas already believed this, since it has always labeled the selection `[Image 1, Image 2, ...]` and prepended that to the prompt (`useGenerator`'s `promptPrefix`) so the model can be referenced by number with no UI labeling. Index 0 is still Image 1: it drives the aspect ratio and is submitted first.
- The model selector is **scoped to models whose edit endpoint can hold the references** (`canvasModelIdsForRefCount` → `useModelSelector({ allowedIds })`); too-small models drop out so references can't be silently truncated. Over `CANVAS_MAX_GROUP_SELECTION` selected → no pill.

There is no separate "Combine" feature anymore (retired into this flow).

**Placement:** "the source" here means the first selected image, which is where the placeholders are anchored (`sourceRef`). Previews lay out to its right; if that would overlap existing images they relocate to clear space below everything (single-image: the source moves with them; group: inputs stay put). The view `fitBounds`-zooms to the new previews. For a single-image generate the origin + its previews are auto-grouped (`groupImages`).

**Remove:** Delete/Backspace takes the selection off the canvas -- membership only, the library rows untouched. No modal, no toast, nothing to dismiss: there is nothing to recover, because the images never left Images. Right-click context menu offers Generate + Remove from Canvas. A failure still speaks: the cards have already left the screen, so silence there would be a lie.

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
- `use-ingest.ts` -- paste, drop, file picker, library picker.
- `use-removal.ts` -- remove-from-canvas, and dismissing a failed tile.
- `use-reconcile.ts` -- place-what-is-unplaced, once per mount.
- `use-autosave.ts` -- the 500ms debounce and its unload flush.
- `use-canvas-prefs.ts` -- display preferences, one JSON blob in localStorage
  under `genzen:canvas-prefs`. **Per browser, never per canvas**: nothing here
  is user data, so it must not reach the `canvases` row or the arrangement save.
  `showModelLabels` is off by default (#394).
- `use-canvas-hotkeys.ts` -- the eleven bindings. There is no undo (#373):
  it rewound arrangement, and arrangement is the thing the board is least
  precious about.

- `use-canvas-generate.ts` -- `useCanvasGenerate()`: composes `useGenerator` + `useModelSelector` + `useUserImages`. `open(selection)` puts the whole selection in the generator's set in order (#297), scopes models by capacity, auto-labels images, creates optimistic placeholders, polls for completion. Pre-fills prompt from `generation_metadata` (single-image only).

## Lib

- `geometry.ts` -- `getBounds`, `spatialSort`, `scaleToFit`, `centerOn` and the
  zoom range. Pure and unit-tested.
- `types.ts` -- `CanvasImage`, `Transform`, `CanvasGroup`, `DragMode`
- `masonry.ts` -- `layoutMasonry()`: column-based masonry algorithm using median input width as default column width
- `persistence.ts` -- the pure mapping between a membership row and a card
  (`memberToImage`, `stateToImages`, `groupsForSave`, `positionsForSave`) plus
  fail-safe wrappers over `_actions/canvas.ts`: `saveCanvas()`, `addToCanvas()`,
  `removeFromCanvas()`, `readLocalImage()`, `preloadUrl()`,
  `getImageDimensions()`, `getUrlDimensions()`. The wrappers swallow failures on
  purpose: a write that cannot reach the server must never take a card off the
  screen. `groupsForSave` is the one non-obvious piece -- a group formed over
  freshly-uploaded cards still holds local placeholder ids, and saving those
  would name images that do not exist on the next load.

## Server

- `_actions/canvas.ts` -- the canvas's database access, user-scoped by
  `resolveAuth()`: `loadCanvasState` (the whole canvas, read by `page.tsx`),
  `saveCanvasState` (positions / viewport / groupings, never membership),
  `addImagesToCanvas`, `removeImagesFromCanvas`,
  `getCanvasGenerationRecord`, `getImagePrompt`. **Nothing here writes
  `user_images`.** The canvas trashed rows until #373; it does not any more, so
  Trash is reached only from Images and owns restore on its own.
  Membership used to be an id-only query from the browser, so an id from
  anywhere flipped a row (#173).
- `#/lib/server/canvas-membership.server.ts` -- `ensureDefaultCanvas`,
  `addCanvasMembers`, `removeCanvasMembers`, `listCanvasMemberIds`. Shared,
  because the generation insert path writes membership too. One canvas per user
  today; `canvases.id` is the seam for more.

## Shared Dependencies

- `#/features/ai-images/hooks/use-generator` -- prompt state, the image set, generation submission
- `../_components/generator-panel/generator-panel` -- reused UI for generation controls
- `#/features/ai-images/server/generate-image.action` -- server action for multi-image combination
- `#/features/user-images/` -- `useUserImages` for upload
- `../_components/existing-image-picker/existing-image-picker` -- library picker
- `#/features/user-images/lib/file-hash` -- `computeFileHash` for dedup on upload
- `#/lib/server/check-pending-generations.action` -- triggers FAL status checks

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
- **There is no undo** (#373). It rewound positions and groupings, which is
  the one thing the board is not precious about -- a scratch surface's layout is
  the byproduct of thinking, not the work. It cost a `pushUndo()` snapshot
  threaded through every mutating gesture, forever, for a recovery nobody
  reached for. If it ever comes back it must stay **local only**: #194 was the
  shape of the bug when something server-side leaned on `undo()` -- cards came
  back on screen, the rows stayed deleted, the next load dropped them for good,
  and it looked like it worked
- Zoom range: 0.02 to 1.0 scale (default 0.5)
- **Cursors are state, never `:active` on the surface.** Cards live inside
  `.canvas`, so `.canvas:active` also fires on a press that landed on a card --
  which is a drag, not a marquee. The crosshair is driven by the `marquee` the
  view already holds, the same way `panMode` is driven by Space. `:active` is
  fine on the card itself, where it matches only what was pressed (#394)
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
