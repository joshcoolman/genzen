'use server'

import type { SavedAiImage } from '#/features/ai-images/types'
import { resolveAuth } from '#/lib/server/auth.server'
import { first, sql } from '#/lib/server/db.server'
import { removeImages } from '#/features/user-images/server/remove-images.action'

// The gallery's reads and deletes, which the browser used to run directly
// against Supabase. As in user-images (#173), the change that matters is that
// `user_id` comes from `resolveAuth()` rather than from the caller.

export async function listGalleryImages(options?: {
  /** Cap the read. The server component's seed passes one (#328); a refresh
   *  that owns the grid's whole state does not. */
  limit?: number
}): Promise<Array<SavedAiImage>> {
  const { userId } = await resolveAuth()

  // `created_at` goes through `to_json(...)#>>'{}'` rather than being selected
  // raw: `SavedAiImage.created_at` is an ISO string, and the driver would
  // otherwise hand back a `Date`.
  //
  // `on_canvas` used to be derived here, per row, by an `exists` over
  // `canvas_images`. Nothing has read it since #314 took the "On canvas" marker
  // off the card -- so every read of the library, including the one every server
  // action triggers, was paying an index probe per row for a value that went
  // straight in the bin (#330). `SavedAiImage.on_canvas` stays on the type as
  // the seam: the surface that wants it again reads it for the rows it renders,
  // rather than the whole library paying in advance.
  //
  // The select list is otherwise as wide as it was, and that is not an
  // oversight: the card renders `title`, `description` and three fields out of
  // `generation_metadata`. Trimming the jsonb to those three would save real
  // bytes and make the type lie about what a `SavedAiImage` contains, which is
  // a bad trade at this size.
  const rows = await sql`
    select ui.id, ui.title, ui.description, ui.storage_path, ui.thumbnail_path,
           to_json(ui.created_at)#>>'{}' as created_at,
           ui.sort_order, ui.status, ui.origin, ui.generation_error,
           ui.generation_metadata, ui.group_id
    from user_images ui
    where ui.user_id = ${userId}
      and ui.source in ('upload', 'ai_generated')
      and ui.deleted_at is null
    order by ui.sort_order desc nulls last
    ${options?.limit ? sql`limit ${options.limit}` : sql``}
  `

  return rows as unknown as Array<SavedAiImage>
}

/**
 * Trash many images in one call (#329).
 *
 * The drawer's Trash button used to loop `deleteGalleryImage` over the
 * selection, awaiting each -- and React serialises server actions anyway, so
 * twelve images was twelve round trips, each one re-rendering the route and
 * re-reading the seed. Selecting things is *for* bulk; it was the path that
 * scaled worst.
 *
 * Two statements rather than one, because the two kinds of row end differently
 * and always have: a failed generation has no picture to restore, so Trash has
 * nothing to offer for it and it goes for good, objects included. Everything
 * else soft-deletes, losing `group_id` on the way so restore has one
 * destination (#319).
 */
export async function trashGalleryImages(
  imageIds: Array<string>,
): Promise<void> {
  const { userId } = await resolveAuth()
  if (imageIds.length === 0) return

  const rows = await sql<
    Array<{
      id: string
      status: string
      storage_path: string | null
      thumbnail_path: string | null
    }>
  >`
    select id, status, storage_path, thumbnail_path
    from user_images
    where user_id = ${userId} and id = any(${imageIds})
  `
  if (rows.length === 0) return

  const failed = rows.filter((r) => r.status === 'failed')
  const rest = rows.filter((r) => r.status !== 'failed')

  if (failed.length > 0) {
    await sql`
      delete from user_images
      where user_id = ${userId} and id = any(${failed.map((r) => r.id)})
    `
    // Defensive, as in the single-image path: a failed row normally has no
    // objects, but a failure late in the pipeline can leave one behind. One
    // storage call for the whole set rather than one per row.
    const paths = failed
      .flatMap((r) => [r.storage_path, r.thumbnail_path])
      .filter((p): p is string => !!p)
    if (paths.length > 0) await removeImages({ storagePaths: paths })
  }

  if (rest.length > 0) {
    await sql`
      update user_images set deleted_at = now(), group_id = null
      where user_id = ${userId} and id = any(${rest.map((r) => r.id)})
    `
  }
}

/**
 * Delete one image -- that image, and nothing else.
 *
 * This used to be a decision about a subtree: hide rather than soft-delete when
 * living variations still rendered this row as their origin thumbnail, then
 * hard-delete the hidden row once its last variation went. That was the only
 * place in the app that destroyed a row and its objects outside of Trash.
 * Genealogy is gone (#204), so there is no subtree to decide about.
 */
export async function deleteGalleryImage(imageId: string): Promise<void> {
  const { userId } = await resolveAuth()

  const image = first(
    await sql<
      Array<{
        id: string
        status: string
        storage_path: string | null
        thumbnail_path: string | null
      }>
    >`
    select id, status, storage_path, thumbnail_path
    from user_images
    where id = ${imageId} and user_id = ${userId}
  `,
  )

  if (!image) return

  // A failed generation produced no image, so Trash has nothing to offer for
  // it -- restoring one just puts an error card back. Deleting it is the user
  // saying "get rid of this", and it goes for good.
  if (image.status === 'failed') {
    await sql`
      delete from user_images where id = ${imageId} and user_id = ${userId}
    `

    // Defensive: a failed row normally has no objects, but a failure late in
    // the pipeline can leave one behind.
    const paths = [image.storage_path, image.thumbnail_path].filter(
      (p): p is string => !!p,
    )
    if (paths.length > 0) await removeImages({ storagePaths: paths })
    return
  }

  // Canvas membership is deliberately untouched (#212). Trashing is a library
  // operation; evicting the image from a canvas as a side effect destroyed an
  // arrangement, and canvas reads already filter `deleted_at is null`.
  //
  // Group membership is the opposite call, and on purpose (#319): trashing
  // clears it, so restore has one destination, always. Remembering the group
  // and restoring into it sounds tidier and fails worse -- you restore an
  // image, look for it at top level, and it is not there, because it silently
  // went back into a group you had forgotten it belonged to. Nothing on screen
  // explains that, so it reads as a failed restore. The cost is re-adding it,
  // and you can see the image the whole time.
  await sql`
    update user_images set deleted_at = now(), group_id = null
    where id = ${imageId} and user_id = ${userId}
  `
}
