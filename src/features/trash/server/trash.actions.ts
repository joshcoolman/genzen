'use server'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { UserImage } from '@/features/user-images/types'
import { resolveAuth } from '@/lib/server/auth.server'
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
  const { userId, supabase } = await resolveAuth()

  const { data, error } = await supabase
    .from('user_images')
    .select('*')
    .eq('user_id', userId)
    .not('deleted_at', 'is', null)
    .eq('hidden', false)
    .in('source', ['upload', 'ai_generated'])
    .order('deleted_at', { ascending: false })

  if (error) throw new Error(error.message)

  const images = data as unknown as Array<UserImage>
  const links = await computeLinks(
    supabase,
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
  supabase: SupabaseClient,
  userId: string,
  trashedIds: Array<string>,
): Promise<TrashLinks> {
  const ids = new Set<string>()
  const counts: Record<string, number> = {}
  const canvasIds = new Set<string>()

  if (trashedIds.length === 0) {
    return { ids: [], counts, canvasIds: [] }
  }

  const trashedSet = new Set(trashedIds)

  const { data: livingImages } = await supabase
    .from('user_images')
    .select('generation_metadata')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .eq('hidden', false)
    .not('generation_metadata', 'is', null)

  for (const row of livingImages ?? []) {
    const meta = row.generation_metadata as Record<string, unknown> | null
    if (!meta) continue

    const refs = [
      typeof meta.source_image_id === 'string' ? meta.source_image_id : null,
      typeof meta.root_image_id === 'string' ? meta.root_image_id : null,
    ].filter((id): id is string => id !== null && trashedSet.has(id))

    for (const refId of refs) {
      ids.add(refId)
      counts[refId] = (counts[refId] || 0) + 1
    }
  }

  const { data: onCanvasRows } = await supabase
    .from('user_images')
    .select('id')
    .eq('user_id', userId)
    .in('id', trashedIds)
    .eq('on_canvas', true)

  for (const row of onCanvasRows ?? []) {
    canvasIds.add(row.id)
    ids.add(row.id)
  }

  return { ids: [...ids], counts, canvasIds: [...canvasIds] }
}

export async function restoreImages(ids: Array<string>): Promise<void> {
  if (ids.length === 0) return
  const { userId, supabase } = await resolveAuth()

  const { error } = await supabase
    .from('user_images')
    .update({ deleted_at: null })
    .eq('user_id', userId)
    .in('id', ids)

  if (error) throw new Error(error.message)
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
  const { userId, supabase } = await resolveAuth()

  let query = supabase
    .from('user_images')
    .select('id, storage_path, thumbnail_path, generation_metadata')
    .eq('user_id', userId)
    .not('deleted_at', 'is', null)
    .eq('hidden', false)

  if (ids) {
    if (ids.length === 0) return []
    query = query.in('id', ids)
  }

  const { data: candidates, error } = await query
  if (error) throw new Error(error.message)
  if (candidates.length === 0) return []

  const links = await computeLinks(
    supabase,
    userId,
    candidates.map((c) => c.id),
  )
  const linked = new Set(links.ids)
  const targets = candidates.filter((c) => !linked.has(c.id))
  if (targets.length === 0) return []

  const targetIds = targets.map((t) => t.id)
  const { error: deleteError } = await supabase
    .from('user_images')
    .delete()
    .eq('user_id', userId)
    .in('id', targetIds)

  if (deleteError) throw new Error(deleteError.message)

  const storagePaths = targets.flatMap((t) => [
    ...(t.storage_path ? [t.storage_path] : []),
    ...(t.thumbnail_path ? [t.thumbnail_path] : []),
  ])
  if (storagePaths.length > 0) await removeImages({ storagePaths })

  // A variation's root may have been hidden only to keep that variation's
  // origin thumbnail alive. With the last variation gone, so is the reason.
  const rootIds = new Set<string>()
  for (const target of targets) {
    const meta = target.generation_metadata as Record<string, unknown> | null
    if (meta?.generation_type !== 'variation') continue
    const rootId =
      (typeof meta.root_image_id === 'string' ? meta.root_image_id : null) ??
      (typeof meta.source_image_id === 'string' ? meta.source_image_id : null)
    if (rootId) rootIds.add(rootId)
  }
  for (const rootId of rootIds) {
    await cleanupHiddenRoot(supabase, userId, rootId)
  }

  return targetIds
}

async function cleanupHiddenRoot(
  supabase: SupabaseClient,
  userId: string,
  rootId: string,
): Promise<void> {
  const { data: root } = await supabase
    .from('user_images')
    .select('id, storage_path, thumbnail_path, hidden')
    .eq('id', rootId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!root?.hidden) return

  const { count } = await supabase
    .from('user_images')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .or(
      `generation_metadata->>root_image_id.eq.${rootId},generation_metadata->>source_image_id.eq.${rootId}`,
    )
    .is('deleted_at', null)

  if (count !== 0) return

  await supabase
    .from('user_images')
    .delete()
    .eq('id', rootId)
    .eq('user_id', userId)

  if (root.storage_path) {
    await removeImages({
      storagePaths: [
        root.storage_path,
        ...(root.thumbnail_path ? [root.thumbnail_path] : []),
      ],
    })
  }
}
