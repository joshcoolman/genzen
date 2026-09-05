'use server'

import type { UserImage } from '#/features/user-images/types'
import { resolveAuth } from '#/lib/server/auth.server'
import { sql } from '#/lib/server/db.server'
import { userImageColumns } from '#/lib/server/user-image-columns.server'
import { removeImages } from '#/features/user-images/server/remove-images.action'

// Trash's reads and writes, which the browser used to run directly against
// Supabase (#173). As elsewhere, `user_id` comes from `resolveAuth()`.
//
// Permanent delete moved here whole rather than query by query, because the
// check that decides whether a delete is allowed at all used to run in the
// browser, on data the browser had fetched earlier -- a client that skipped it
// deleted whatever it liked.
//
// **Nothing in this list is locked.** Canvas membership used to block a
// permanent delete (#212, removed in #371, restored in #375), with a "Canvas"
// badge to explain why. #446 inverted it at the source: every soft-delete path
// now clears canvas membership the way it already cleared `group_id`, so a row
// that reaches this list is on no board and there is nothing left to preserve.
// What the lock actually cost was a chore -- you could not empty the bin
// without going to find the board a card was still on, and with several boards
// that is several places to look.

export async function listTrashedImages(): Promise<Array<UserImage>> {
  const { userId } = await resolveAuth()

  return sql<Array<UserImage>>`
    select ${userImageColumns()}
    from user_images
    where user_id = ${userId}
      and deleted_at is not null
      -- ai_video is here because Video can now bin a clip, and because
      -- permanentlyDeleteImages() with no ids already destroys every trashed
      -- row whatever its source. Left out, a trashed clip was invisible in the
      -- one place that could restore it and still swept by Empty Trash -- gone
      -- from a list it was never on.
      and source in ('upload', 'ai_generated', 'ai_video')
    -- Most-recently-deleted first, and it is load-bearing: Trash is the only
    -- safety net left now that nothing reversible asks first (#236). id breaks
    -- the tie because a batch trash writes one now() across every row, and
    -- without it those rows come back in whatever order Postgres feels like --
    -- a different order on each visit, for exactly the images most likely to be
    -- the mistake being looked for.
    order by deleted_at desc, id desc
  `
}

export async function restoreImages(ids: Array<string>): Promise<void> {
  if (ids.length === 0) return
  const { userId } = await resolveAuth()

  await sql`
    update user_images set deleted_at = null
    where user_id = ${userId} and id in ${sql(ids)}
  `
}

/**
 * Permanently delete trashed images.
 *
 * Pass no ids to empty the trash. Returns the ids actually destroyed, so the
 * caller can reconcile against what happened rather than assume its request
 * matched the bin -- a row can go from another tab between load and click.
 */
export async function permanentlyDeleteImages(
  ids?: Array<string>,
): Promise<Array<string>> {
  const { userId } = await resolveAuth()

  if (ids && ids.length === 0) return []

  const targets = await sql<
    Array<{
      id: string
      storage_path: string | null
      thumbnail_path: string | null
      end_frame_path: string | null
    }>
  >`
    select id, storage_path, thumbnail_path, end_frame_path
    from user_images
    where user_id = ${userId}
      and deleted_at is not null
      ${ids ? sql`and id in ${sql(ids)}` : sql``}
  `

  if (targets.length === 0) return []

  const targetIds = targets.map((t) => t.id)
  await sql`
    delete from user_images
    where user_id = ${userId} and id in ${sql(targetIds)}
  `

  const storagePaths = targets.flatMap((t) => [
    ...(t.storage_path ? [t.storage_path] : []),
    ...(t.thumbnail_path ? [t.thumbnail_path] : []),
    ...(t.end_frame_path ? [t.end_frame_path] : []),
  ])
  if (storagePaths.length > 0) await removeImages({ storagePaths })

  return targetIds
}
