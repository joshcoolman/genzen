'use server'

import type { UserImage } from '#/features/user-images/types'
import { resolveAuth } from '#/lib/server/auth.server'
import { sql } from '#/lib/server/db.server'
import { userImageColumns } from '#/lib/server/user-image-columns.server'
import { removeImages } from '#/features/user-images/server/remove-images.action'

// Trash's reads and writes, which the browser used to run directly against
// Supabase (#173). As elsewhere, `user_id` comes from `resolveAuth()`.
//
// Permanent delete moved here whole rather than query by query, and the link
// check that decides whether a delete is allowed at all used to run in the
// browser, on data the browser had fetched earlier -- a client that skipped it
// deleted whatever it liked. Now the check and the delete are the same call,
// and `linkedIds` is advisory UI state rather than the guard.
//
// Being a generation's source used to count as a link too, because the derived
// card rendered this row as its origin thumbnail. Genealogy is gone (#204), so
// canvas membership is the only living dependency left -- and since #212 it is a
// `canvas_images` row rather than a boolean on the image.

export interface TrashLinks {
  /** Trashed ids that something living still depends on -- not deletable. */
  ids: Array<string>
  /** Subset of `ids` blocked specifically by canvas membership. */
  canvasIds: Array<string>
}

export interface TrashPayload {
  images: Array<UserImage>
  links: TrashLinks
}

export async function listTrashedImages(): Promise<TrashPayload> {
  const { userId } = await resolveAuth()

  const images = await sql<Array<UserImage>>`
    select ${userImageColumns()}
    from user_images
    where user_id = ${userId}
      and deleted_at is not null
      and source in ('upload', 'ai_generated')
    -- Most-recently-deleted first, and it is load-bearing: Trash is the only
    -- safety net left now that nothing reversible asks first (#236). id breaks
    -- the tie because a batch trash writes one now() across every row, and
    -- without it those rows come back in whatever order Postgres feels like --
    -- a different order on each visit, for exactly the images most likely to be
    -- the mistake being looked for.
    order by deleted_at desc, id desc
  `

  const links = await computeLinks(
    userId,
    images.map((img) => img.id),
  )
  return { images, links }
}

/**
 * Which trashed ids are still depended on by something living: placed on a
 * canvas.
 *
 * A membership row, not a flag (#212). The guard is now a *policy* rather than a
 * necessity -- `canvas_images.image_id` cascades, so a permanent delete would
 * take the card with it rather than leaving a dangling reference. It stays
 * because that is exactly what makes it worth blocking: an irreversible delete
 * would silently change a canvas the user is not looking at, and trashing was
 * already deliberately made not to.
 */
async function computeLinks(
  userId: string,
  trashedIds: Array<string>,
): Promise<TrashLinks> {
  if (trashedIds.length === 0) return { ids: [], canvasIds: [] }

  const rows = await sql<Array<{ image_id: string }>>`
    select distinct image_id from canvas_images
    where user_id = ${userId} and image_id in ${sql(trashedIds)}
  `

  const canvasIds = rows.map((r) => r.image_id)
  return { ids: canvasIds, canvasIds }
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
 * Permanently delete trashed images, skipping any that are still linked.
 *
 * Pass no ids to empty the trash. Returns the ids actually destroyed, so the
 * caller can reconcile rather than assume its request was honoured wholesale --
 * the linked set is recomputed here and may not match what the client believed.
 */
export async function permanentlyDeleteImages(
  ids?: Array<string>,
): Promise<Array<string>> {
  const { userId } = await resolveAuth()

  if (ids && ids.length === 0) return []

  const candidates = await sql<
    Array<{
      id: string
      storage_path: string | null
      thumbnail_path: string | null
    }>
  >`
    select id, storage_path, thumbnail_path
    from user_images
    where user_id = ${userId}
      and deleted_at is not null
      ${ids ? sql`and id in ${sql(ids)}` : sql``}
  `

  if (candidates.length === 0) return []

  const links = await computeLinks(
    userId,
    candidates.map((c) => c.id),
  )
  const linked = new Set(links.ids)
  const targets = candidates.filter((c) => !linked.has(c.id))
  if (targets.length === 0) return []

  const targetIds = targets.map((t) => t.id)
  await sql`
    delete from user_images
    where user_id = ${userId} and id in ${sql(targetIds)}
  `

  const storagePaths = targets.flatMap((t) => [
    ...(t.storage_path ? [t.storage_path] : []),
    ...(t.thumbnail_path ? [t.thumbnail_path] : []),
  ])
  if (storagePaths.length > 0) await removeImages({ storagePaths })

  return targetIds
}
