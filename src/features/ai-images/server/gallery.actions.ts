'use server'

import type { SavedAiImage } from '@/features/ai-images/types'
import type { Tables } from '@/lib/types/supabase'
import { resolveAuth } from '@/lib/server/auth.server'
import { removeImages } from '@/features/user-images/server/remove-images.server'
import { ungroupImages } from '@/features/ai-images/server/ungroup-images.server'

// The gallery's reads and deletes, which the browser used to run directly
// against Supabase. As in user-images (#173), the change that matters is that
// `user_id` comes from `resolveAuth()` rather than from the caller.
//
// The deletes moved wholesale rather than one query at a time. Cascading a
// delete took four browser round trips reading each other's results -- count
// variations, hide or soft-delete, re-read the root, maybe hard-delete it --
// with the row free to change underneath between each. Server-side they are one
// call, and the client is left with one thing to say: delete this.

export interface RootImageMeta {
  hidden: boolean
}

export interface GalleryPayload {
  images: Array<SavedAiImage>
  /** Sources of edits/variations that are not themselves in `images` --
   *  needed for the little origin thumbnail on a derived card. */
  rootImages: Array<
    Pick<Tables<'user_images'>, 'id' | 'storage_path' | 'thumbnail_path'> & {
      hidden: boolean
    }
  >
}

const GALLERY_COLUMNS =
  'id, title, description, storage_path, thumbnail_path, created_at, sort_order, status, generation_error, generation_metadata'

export async function listGalleryImages(): Promise<GalleryPayload> {
  const { userId, supabase } = await resolveAuth()

  const { data, error } = await supabase
    .from('user_images')
    .select(GALLERY_COLUMNS)
    .eq('user_id', userId)
    .in('source', ['upload', 'ai_generated'])
    .is('deleted_at', null)
    .order('sort_order', { ascending: false, nullsFirst: false })

  if (error) throw new Error(error.message)
  const images = data as unknown as Array<SavedAiImage>

  // A derived card shows its source. The source may be hidden or filtered out
  // of the list above, so it is resolved here rather than in a second call.
  const present = new Set(images.map((img) => img.id))
  const rootIds = new Set<string>()
  for (const img of images) {
    const meta = img.generation_metadata
    if (
      meta?.generation_type !== 'edit' &&
      meta?.generation_type !== 'variation'
    )
      continue
    const sourceId = meta.source_image_id
    if (sourceId && !present.has(sourceId)) rootIds.add(sourceId)
  }

  if (rootIds.size === 0) return { images, rootImages: [] }

  const { data: rootRows, error: rootError } = await supabase
    .from('user_images')
    .select('id, storage_path, thumbnail_path, hidden')
    .eq('user_id', userId)
    .in('id', Array.from(rootIds))
    .is('deleted_at', null)

  if (rootError) throw new Error(rootError.message)

  return {
    images,
    rootImages: rootRows.map((r) => ({
      id: r.id,
      storage_path: r.storage_path,
      thumbnail_path: r.thumbnail_path,
      hidden: !!r.hidden,
    })),
  }
}

/**
 * Delete one image.
 *
 * Hides rather than soft-deletes when living variations still point at it --
 * they render its thumbnail as their origin, so removing it would blank them.
 * A hidden root is hard-deleted once its last variation goes, which is the only
 * place in the app that destroys a row and its objects.
 */
export async function deleteGalleryImage(imageId: string): Promise<void> {
  const { userId, supabase } = await resolveAuth()

  const { data: image, error: readError } = await supabase
    .from('user_images')
    .select('id, generation_metadata')
    .eq('id', imageId)
    .eq('user_id', userId)
    .maybeSingle()

  if (readError) throw new Error(readError.message)
  if (!image) return

  const { count: variationCount, error: countError } = await supabase
    .from('user_images')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .or(
      `generation_metadata->>root_image_id.eq.${imageId},generation_metadata->>source_image_id.eq.${imageId}`,
    )
    .is('deleted_at', null)
    .eq('hidden', false)

  if (countError) throw new Error(countError.message)

  const { error: writeError } = await supabase
    .from('user_images')
    .update(
      variationCount && variationCount > 0
        ? { hidden: true }
        : { deleted_at: new Date().toISOString() },
    )
    .eq('id', imageId)
    .eq('user_id', userId)

  if (writeError) throw new Error(writeError.message)

  const meta = image.generation_metadata as Record<string, unknown> | null
  if (meta?.generation_type !== 'variation') return
  const rootId = (meta.root_image_id ?? meta.source_image_id) as
    | string
    | undefined
  if (rootId) await cleanupHiddenRoot(rootId, imageId, userId, supabase)
}

async function cleanupHiddenRoot(
  rootId: string,
  excludeId: string,
  userId: string,
  supabase: Awaited<ReturnType<typeof resolveAuth>>['supabase'],
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
    .neq('id', excludeId)

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

/**
 * Delete an image and everything grouped under it, as one subtree.
 *
 * Walks `parent_id` (grouping), not `source_image_id` (genealogy) -- the
 * genealogy fields survive the delete so the rows stay independently
 * restorable from trash.
 */
export async function deleteGalleryImageWithDescendants(
  imageId: string,
): Promise<Array<string>> {
  const { userId, supabase } = await resolveAuth()

  const { data: allRows, error } = await supabase
    .from('user_images')
    .select('id, generation_metadata')
    .eq('user_id', userId)
    .is('deleted_at', null)

  if (error) throw new Error(error.message)

  const childrenOf = new Map<string, Array<string>>()
  for (const row of allRows) {
    const meta = row.generation_metadata as Record<string, unknown> | null
    const parentId = meta?.parent_id as string | undefined
    if (!parentId) continue
    const siblings = childrenOf.get(parentId) ?? []
    siblings.push(row.id)
    childrenOf.set(parentId, siblings)
  }

  const idsToDelete = new Set<string>([imageId])
  const queue = [imageId]
  while (queue.length > 0) {
    const current = queue.shift()!
    for (const childId of childrenOf.get(current) ?? []) {
      if (idsToDelete.has(childId)) continue
      idsToDelete.add(childId)
      queue.push(childId)
    }
  }

  const childIds = Array.from(idsToDelete).filter((id) => id !== imageId)
  if (childIds.length > 0) await ungroupImages({ imageIds: childIds })

  const { error: deleteError } = await supabase
    .from('user_images')
    .update({ deleted_at: new Date().toISOString() })
    .eq('user_id', userId)
    .in('id', Array.from(idsToDelete))

  if (deleteError) throw new Error(deleteError.message)
  return Array.from(idsToDelete)
}

/**
 * Storage paths of everything grouped beneath `imageId`, in breadth-first
 * order -- the download-as-zip path, which needs the whole subtree's objects
 * and not just what the gallery happens to be holding.
 */
export async function listSubtreeStoragePaths(
  imageId: string,
): Promise<Array<string>> {
  const { userId, supabase } = await resolveAuth()

  const { data: allRows, error } = await supabase
    .from('user_images')
    .select('id, storage_path, generation_metadata')
    .eq('user_id', userId)
    .is('deleted_at', null)

  if (error) throw new Error(error.message)

  const childrenOf = new Map<
    string,
    Array<{ id: string; storage_path: string | null }>
  >()
  for (const row of allRows) {
    const meta = row.generation_metadata as Record<string, unknown> | null
    const parentId = meta?.parent_id as string | undefined
    if (!parentId) continue
    const siblings = childrenOf.get(parentId) ?? []
    siblings.push({ id: row.id, storage_path: row.storage_path })
    childrenOf.set(parentId, siblings)
  }

  const paths: Array<string> = []
  const visited = new Set<string>()
  const queue = [imageId]
  while (queue.length > 0) {
    const current = queue.shift()!
    for (const row of childrenOf.get(current) ?? []) {
      if (visited.has(row.id)) continue
      visited.add(row.id)
      if (row.storage_path) paths.push(row.storage_path)
      queue.push(row.id)
    }
  }
  return paths
}

/** Delete an image but leave its group members in the gallery, unparented. */
export async function deleteGalleryImageDetachingChildren(
  imageId: string,
): Promise<void> {
  const { userId, supabase } = await resolveAuth()

  await ungroupImages({ parentId: imageId })

  const { error } = await supabase
    .from('user_images')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', imageId)
    .eq('user_id', userId)

  if (error) throw new Error(error.message)
}

/** Un-hide a root that was hidden to keep its variations' origin thumbnail. */
export async function restoreHiddenRootImage(rootId: string): Promise<void> {
  const { userId, supabase } = await resolveAuth()

  const { error } = await supabase
    .from('user_images')
    .update({ hidden: false })
    .eq('id', rootId)
    .eq('user_id', userId)

  if (error) throw new Error(error.message)
}
