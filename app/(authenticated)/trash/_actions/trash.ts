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
// **Canvas membership blocks a permanent delete** (#212, removed in #371,
// restored in #375). The history is worth keeping because the same rule was
// right, then wrong, then right again for a structural reason.
//
// #212 added the lock, and it deadlocked: the only way a card left a canvas was
// a trash that deliberately kept the membership row, so every image deleted
// from a canvas arrived here permanently undeletable with no gesture anywhere
// that cleared it. #371 removed the lock, correctly, because a lock with no key
// is just a wall.
//
// #373 cut the key. Remove-from-canvas exists again, the canvas no longer
// filters `deleted_at`, and a trashed image stays on the board until it is
// taken off it. So the badge here is now a live fact about something the user
// can see, and the lock is what stops an Empty Trash from destroying a card off
// a canvas nobody was looking at. Remove it from the canvas and the row becomes
// deletable.

export interface TrashLinks {
  /** Trashed ids that still hold a canvas membership row: still on the board,
   *  so not deletable until they are taken off it. */
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

/** Which trashed ids are still on a canvas: badge, and the delete lock. */
async function computeLinks(
  userId: string,
  trashedIds: Array<string>,
): Promise<TrashLinks> {
  if (trashedIds.length === 0) return { canvasIds: [] }

  const rows = await sql<Array<{ image_id: string }>>`
    select distinct image_id from canvas_images
    where user_id = ${userId} and image_id in ${sql(trashedIds)}
  `

  return { canvasIds: rows.map((r) => r.image_id) }
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
 * Permanently delete trashed images, skipping any still on a canvas.
 *
 * Pass no ids to empty the trash. Returns the ids actually destroyed, so the
 * caller can reconcile rather than assume its request was honoured wholesale --
 * the locked set is recomputed here, so it is not something a client can skip.
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

  const { canvasIds } = await computeLinks(
    userId,
    candidates.map((c) => c.id),
  )
  const locked = new Set(canvasIds)
  const targets = candidates.filter((c) => !locked.has(c.id))
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
