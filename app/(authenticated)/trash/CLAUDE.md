# Trash

Soft-delete recovery for user images: restore, permanent delete, batch
operations, and a ZIP download of everything in the bin.

Built to `docs/reference/route-shape.md`. `page.tsx` is a server component that
reads and hands the payload to `view.tsx` as `initial`; `use-view.ts` owns every
read after that.

## Quirks

- **Failed generations never arrive here.** Deleting one from Images destroys
  the row (`deleteGalleryImage`): there is no image to restore, and a restored
  failure is just an error card again
- Queries filter by `deleted_at IS NOT NULL` and
  `source IN ('upload', 'ai_generated')`
- **An image still on a canvas cannot be permanently deleted.** Added in #212,
  removed in #371, restored in #375 — and the reversals are the point. #212's
  lock had no key: the only way a card left a canvas was a trash that kept the
  `canvas_images` row, so every canvas image landed here undeletable forever
  with no gesture anywhere that cleared it. #371 removed it. #373 cut the key —
  remove-from-canvas is a verb again — and #375 made a trashed image _stay_ on
  the board, so the badge names something the user can see and the lock is what
  stops an Empty Trash from destroying a card off a live canvas. Remove it from
  the canvas to delete it
- Being a generation's source used to count as a link too, and went with
  genealogy (#204). Canvas membership is the only one left
- `links.canvasIds` drives the badge and the disabled state, but is not the
  guard: `permanentlyDeleteImages` recomputes the set server-side and returns
  what it actually destroyed, so a client cannot skip it
- Mutations are optimistic with a refetch on error
- No realtime (#174). Trash only changes from an action on this page or a delete
  elsewhere, and either way the next visit re-reads it
- Image URLs are `/img/[id]`, app-served and session-checked (#226)
