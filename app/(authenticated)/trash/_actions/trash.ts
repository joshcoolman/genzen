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
// Canvas membership used to block a permanent delete outright (#212), and that
// was a deadlock: trashing from the canvas deliberately keeps the
// `canvas_images` row so a restore lands back at its coordinates, so every
// image deleted from a canvas arrived here already carrying the thing that
// made it undeletable, with no gesture anywhere that cleared it (#371). The
// guard protected nothing either way -- it only ever ran over trashed rows,
// and the canvas read filters `deleted_at`, so the card it was "protecting"
// was already invisible on every board. `canvas_images.image_id` cascades.
//
// Membership survives as a badge, not a veto: it tells you a restore will put
// this back on a canvas.

export interface TrashLinks {
  /** Trashed ids that still hold a canvas membership row. Informational -- it
   *  drives the badge and nothing else. */
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

/** Which trashed ids still hold a canvas membership row, for the badge. */
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
 * Permanently delete trashed images.
 *
 * Pass no ids to empty the trash. Returns the ids actually destroyed, so the
 * caller can reconcile rather than assume its request was honoured wholesale --
 * a row can leave the trash between the page load and the click.
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

  const targetIds = candidates.map((c) => c.id)
  await sql`
    delete from user_images
    where user_id = ${userId} and id in ${sql(targetIds)}
  `

  const storagePaths = candidates.flatMap((c) => [
    ...(c.storage_path ? [c.storage_path] : []),
    ...(c.thumbnail_path ? [c.thumbnail_path] : []),
  ])
  if (storagePaths.length > 0) await removeImages({ storagePaths })

  return targetIds
}
