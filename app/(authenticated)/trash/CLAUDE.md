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
- Queries filter by `deleted_at IS NOT NULL` and `hidden = false` and
  `source IN ('upload', 'ai_generated')`
- **Linked image protection.** An image is undeletable while something living
  points at it -- referenced through `generation_metadata`, or placed on the
  canvas (`on_canvas = true`). The client's `linkedImageIds` only drives the
  disabled state; `permanentlyDeleteImages` recomputes the set server-side and
  returns what it actually destroyed, so the guard is not something a client can
  skip
- Permanent delete cascades: deleting a variation whose hidden root has no
  remaining living variations cleans up the root too
- Mutations are optimistic with a refetch on error
- No realtime (#174). Trash only changes from an action on this page or a delete
  elsewhere, and either way the next visit re-reads it
- Image URLs are public S3 URLs via `createImageStorage()`, no signing or expiry
