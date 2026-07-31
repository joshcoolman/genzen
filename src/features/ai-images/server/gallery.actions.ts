'use server'

import type { SavedAiImage } from '#/features/ai-images/types'
import { resolveAuth } from '#/lib/server/auth.server'
import { first, sql } from '#/lib/server/db.server'
import { removeImages } from '#/features/user-images/server/remove-images.server'

// The gallery's reads and deletes, which the browser used to run directly
// against Supabase. As in user-images (#173), the change that matters is that
// `user_id` comes from `resolveAuth()` rather than from the caller.

export async function listGalleryImages(): Promise<Array<SavedAiImage>> {
  const { userId } = await resolveAuth()

  // `created_at` goes through `to_json(...)#>>'{}'` rather than being selected
  // raw: `SavedAiImage.created_at` is an ISO string, and the driver would
  // otherwise hand back a `Date`.
  // `on_canvas` is derived, never stored -- the boolean column of that name was
  // deleted in #205 precisely because it drifted from the membership rows that
  // are the truth. `exists` over `canvas_images_user_image_idx` (user_id,
  // image_id), so it costs an index probe per row rather than a join.
  //
  // A boolean is enough while there is one canvas per user. The day there are
  // several, this becomes the canvas name and the marker says which -- same
  // query shape, one more column.
  const rows = await sql`
    select ui.id, ui.title, ui.description, ui.storage_path, ui.thumbnail_path,
           to_json(ui.created_at)#>>'{}' as created_at,
           ui.sort_order, ui.status, ui.origin, ui.generation_error,
           ui.generation_metadata,
           exists (
             select 1 from canvas_images ci
             where ci.image_id = ui.id and ci.user_id = ${userId}
           ) as on_canvas
    from user_images ui
    where ui.user_id = ${userId}
      and ui.source in ('upload', 'ai_generated')
      and ui.deleted_at is null
    order by ui.sort_order desc nulls last
  `

  return rows as unknown as Array<SavedAiImage>
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
  await sql`
    update user_images set deleted_at = now()
    where id = ${imageId} and user_id = ${userId}
  `
}
