# Trash

Soft-delete recovery for user images: restore, permanent delete, batch
operations, and a ZIP download of everything in the bin. That dialog is
`ZipDownloadDialog` in `#/components` since #477 -- the Images group page and
the selection drawer (#480) download through the same one, so a change here
changes all three.

Built to `docs/reference/route-shape.md`. `page.tsx` is a server component that
reads and hands the payload to `view.tsx` as `initial`; `use-view.ts` owns every
read after that.

## Quirks

- **Failed generations never arrive here.** Deleting one from Images destroys
  the row (`deleteGalleryImage`): there is no image to restore, and a restored
  failure is just an error card again
- The list filters by `deleted_at IS NOT NULL` and
  `source IN ('upload', 'ai_generated', 'ai_video')`. **Permanent delete filters
  by neither** — `permanentlyDeleteImages()` with no ids destroys every trashed
  row of this user whatever its source, which is why the list has to show every
  source it can destroy. Clips were the case that made the gap real: Video
  gained a delete, and a trashed clip was invisible in the one place that could
  restore it while Empty Trash still swept it
- **A clip's row renders `MediaBox`, not an `ImageBox`.** An mp4 in an `<img>`
  is the broken-file fallback, so every clip in the bin would look the same —
  (clips have had a real poster frame since #499, but no surface reads it yet;
  that is #500) —
  and a clip's title is its model, so several read identically. The frame comes
  from `firstFrameSrc()`, which appends `#t=0.001` to make the element seek;
  `preload="metadata"` on its own paints nothing, which was believed for a while
  and is written up in `#/components/media-box`. The `kind` prop went on that
  new primitive rather than on `ImageBox` (#398), after the decision came up
  three times
- **Nothing in the bin is locked, and there is no "Canvas" badge.** Both existed
  to protect a card that was still on a board (#212, #371, #375); #446 inverted
  it at the source — every soft-delete path clears canvas membership the way it
  clears `group_id`, so a row that reaches this list is on no board. Do not
  reintroduce either as a safety net: preserving an image because it was on a
  canvas is what made emptying the bin a chore of going to find the board first,
  and with several boards that is several places to look
- Being a generation's source used to count as a link too, and went with
  genealogy (#204). Canvas membership was the last one, and it is gone
- Mutations are optimistic with a refetch on error
- No realtime (#174). Trash only changes from an action on this page or a delete
  elsewhere, and either way the next visit re-reads it
- Image URLs are `/img/[id]`, app-served and session-checked (#226)
