'use server'

import type { UserImage } from '@/features/user-images/types'
import { resolveAuth } from '@/lib/server/auth.server'
import { first, sql } from '@/lib/server/db.server'
import { userImageColumns } from '@/lib/server/user-image-columns.server'
import { removeImages } from '@/features/user-images/server/remove-images.server'

// Trash's reads and writes, which the browser used to run directly against
// Supabase (#173). As elsewhere, `user_id` comes from `resolveAuth()`.
//
// Permanent delete moved here whole rather than query by query. It was a
// sequence of browser round trips -- check what's linked, delete the row, delete
// the objects, re-read a hidden root, count its survivors, maybe delete that too
// -- and the link check that decides whether a delete is allowed at all ran in
// the browser, on data the browser had fetched earlier. A client that skipped
// the check deleted whatever it liked. Now the check and the delete are the same
// call, and `linkedIds` is advisory UI state rather than the guard.

export interface TrashLinks {
  /** Trashed ids that something living still depends on -- not deletable. */
  ids: Array<string>
  /** How many living images reference each id, for the UI's "N linked". */
  counts: Record<string, number>
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
      and hidden = false
      and source in ('upload', 'ai_generated')
    order by deleted_at desc
  `

  const links = await computeLinks(
    userId,
    images.map((img) => img.id),
  )
  return { images, links }
}

/**
 * Which trashed ids are still depended on by something living: referenced as a
 * generation's source/root, or placed on the canvas.
 */
async function computeLinks(
  userId: string,
  trashedIds: Array<string>,
): Promise<TrashLinks> {
  const ids = new Set<string>()
  const counts: Record<string, number> = {}
  const canvasIds = new Set<string>()

  if (trashedIds.length === 0) {
    return { ids: [], counts, canvasIds: [] }
  }

  // Counting used to mean reading every living row's metadata and tallying in
  // JS. The `values` join is what preserves the old arithmetic: a row naming
  // the same trashed id as *both* its source and its root counted twice, and
  // still does, because it contributes two rows here.
  const refCounts = await sql<Array<{ ref: string; count: number }>>`
    select t.ref, count(*)::int as count
    from user_images ui
    cross join lateral (values
      (ui.generation_metadata->>'source_image_id'),
      (ui.generation_metadata->>'root_image_id')
    ) as t(ref)
    where ui.user_id = ${userId}
      and ui.deleted_at is null
      and ui.hidden = false
      and t.ref = any(${trashedIds}::text[])
    group by t.ref
  `

  for (const row of refCounts) {
    ids.add(row.ref)
    counts[row.ref] = row.count
  }

  const onCanvasRows = await sql<Array<{ id: string }>>`
    select id from user_images
    where user_id = ${userId} and id in ${sql(trashedIds)} and on_canvas = true
  `

  for (const row of onCanvasRows) {
    canvasIds.add(row.id)
    ids.add(row.id)
  }

  return { ids: [...ids], counts, canvasIds: [...canvasIds] }
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
      generation_metadata: Record<string, unknown> | null
    }>
  >`
    select id, storage_path, thumbnail_path, generation_metadata
    from user_images
    where user_id = ${userId}
      and deleted_at is not null
      and hidden = false
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

  // A variation's root may have been hidden only to keep that variation's
  // origin thumbnail alive. With the last variation gone, so is the reason.
  const rootIds = new Set<string>()
  for (const target of targets) {
    const meta = target.generation_metadata
    if (meta?.generation_type !== 'variation') continue
    const rootId =
      (typeof meta.root_image_id === 'string' ? meta.root_image_id : null) ??
      (typeof meta.source_image_id === 'string' ? meta.source_image_id : null)
    if (rootId) rootIds.add(rootId)
  }
  for (const rootId of rootIds) {
    await cleanupHiddenRoot(userId, rootId)
  }

  return targetIds
}

async function cleanupHiddenRoot(
  userId: string,
  rootId: string,
): Promise<void> {
  const root = first(
    await sql<
      Array<{
        id: string
        storage_path: string | null
        thumbnail_path: string | null
        hidden: boolean
      }>
    >`
    select id, storage_path, thumbnail_path, hidden
    from user_images
    where id = ${rootId} and user_id = ${userId}
  `,
  )

  if (!root?.hidden) return

  const [{ count }] = await sql<Array<{ count: number }>>`
    select count(*)::int as count
    from user_images
    where user_id = ${userId}
      and (generation_metadata->>'root_image_id' = ${rootId}
           or generation_metadata->>'source_image_id' = ${rootId})
      and deleted_at is null
  `

  if (count !== 0) return

  await sql`delete from user_images where id = ${rootId} and user_id = ${userId}`

  if (root.storage_path) {
    await removeImages({
      storagePaths: [
        root.storage_path,
        ...(root.thumbnail_path ? [root.thumbnail_path] : []),
      ],
    })
  }
}
