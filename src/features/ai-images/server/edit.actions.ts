'use server'

import type { Tables } from '@/lib/types/supabase'
import { resolveAuth } from '@/lib/server/auth.server'

// The edit page's reads, which the browser used to run directly against
// Supabase (#173). As elsewhere, `user_id` comes from `resolveAuth()`.
//
// The two tree walks moved with them. Both used to pull every one of the user's
// image rows into the browser to find a handful of descendants -- the BFS was
// client-side only because the data happened to be there. Server-side the
// browser asks for descendants and gets descendants.

export interface EditSourceImage {
  id: string
  title: string | null
  storage_path: string
  generation_metadata: Record<string, unknown> | null
}

/** One image's row, as the edit page's source. */
export async function getEditSourceImage(
  imageId: string,
): Promise<EditSourceImage | null> {
  const { userId, supabase } = await resolveAuth()

  const { data, error } = await supabase
    .from('user_images')
    .select('id, title, storage_path, generation_metadata')
    .eq('user_id', userId)
    .eq('id', imageId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data?.storage_path) return null

  return {
    id: data.id,
    title: data.title,
    storage_path: data.storage_path,
    generation_metadata: data.generation_metadata as Record<
      string,
      unknown
    > | null,
  }
}

type ParentRow = Pick<
  Tables<'user_images'>,
  'id' | 'storage_path' | 'thumbnail_path' | 'generation_metadata'
>

/**
 * Every image whose `parent_id` chain reaches `rootId`, plus the root itself,
 * in BFS order. `parent_id` is the mutable organizational parent, not the
 * immutable generation source.
 */
export async function listDescendantIds(
  rootId: string,
): Promise<Array<string>> {
  const { userId, supabase } = await resolveAuth()

  const { data, error } = await supabase
    .from('user_images')
    .select('id, generation_metadata')
    .eq('user_id', userId)
    .in('source', ['upload', 'ai_generated'])
    .is('deleted_at', null)

  if (error) throw new Error(error.message)

  return walk(
    [rootId],
    childrenByParent(data as unknown as Array<ParentRow>, (row) => row.id),
  ).chain
}

export interface EditChildRef {
  id: string
  storagePath: string
  thumbnailPath: string | null
}

/**
 * Descendants of each given parent, newest first -- the nested thumbnails under
 * a gallery card. Only completed, undeleted images with a stored file.
 */
export async function listEditChildren(
  parentIds: Array<string>,
): Promise<Record<string, Array<EditChildRef>>> {
  if (parentIds.length === 0) return {}

  const { userId, supabase } = await resolveAuth()

  const { data, error } = await supabase
    .from('user_images')
    .select('id, storage_path, thumbnail_path, generation_metadata')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  const rows = data as unknown as Array<ParentRow>
  const childrenOf = childrenByParent(rows, (row) => row)

  // Rows arrive created_at desc, so position is recency.
  const recency = new Map<string, number>()
  rows.forEach((row, i) => recency.set(row.id, i))

  const result: Record<string, Array<EditChildRef>> = {}
  for (const rootId of parentIds) {
    const { visited } = walk([rootId], childrenOf)
    const descendants = visited
      .filter((row) => row.storage_path)
      .map((row) => ({
        id: row.id,
        storagePath: row.storage_path!,
        thumbnailPath: row.thumbnail_path,
      }))
    if (descendants.length === 0) continue
    descendants.sort(
      (a, b) => (recency.get(a.id) ?? 999) - (recency.get(b.id) ?? 999),
    )
    result[rootId] = descendants
  }

  return result
}

export interface EditSourceRef {
  id: string
  storage_path: string | null
  thumbnail_path: string | null
  hidden: boolean
}

/** The rows an edit/variation names as its source, for the origin thumbnail. */
export async function listEditSourceRefs(
  ids: Array<string>,
): Promise<Array<EditSourceRef>> {
  if (ids.length === 0) return []

  const { userId, supabase } = await resolveAuth()

  const { data, error } = await supabase
    .from('user_images')
    .select('id, storage_path, thumbnail_path, hidden')
    .eq('user_id', userId)
    .in('id', ids)
    .is('deleted_at', null)

  if (error) throw new Error(error.message)

  return data.map((row) => ({
    id: row.id,
    storage_path: row.storage_path,
    thumbnail_path: row.thumbnail_path,
    hidden: !!row.hidden,
  }))
}

export type GenerationResultRow = Pick<
  Tables<'user_images'>,
  | 'id'
  | 'storage_path'
  | 'thumbnail_path'
  | 'status'
  | 'generation_metadata'
  | 'title'
  | 'file_size'
  | 'created_at'
>

/**
 * The edit page's recent generations. Filtering by type or by group membership
 * is applied to the most recent `limit` rows -- the window is what's recent,
 * not what matches, which is what the browser did when it held this query.
 */
export async function listGenerationResultRows({
  generationType,
  limit,
  sourceImageIds,
}: {
  generationType: string | Array<string>
  limit: number
  sourceImageIds?: Array<string>
}): Promise<Array<GenerationResultRow>> {
  const { userId, supabase } = await resolveAuth()

  const { data, error } = await supabase
    .from('user_images')
    .select(
      'id, storage_path, thumbnail_path, status, generation_metadata, title, file_size, created_at',
    )
    .eq('user_id', userId)
    .in('source', ['upload', 'ai_generated'])
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)

  const types = Array.isArray(generationType)
    ? generationType
    : [generationType]
  const chain = sourceImageIds?.length ? new Set(sourceImageIds) : null

  return data.filter((row) => {
    const meta = row.generation_metadata as Record<string, unknown> | null
    if (chain) {
      // Group membership is `parent_id` (mutable), not `source_image_id`
      // (immutable generation history).
      return typeof meta?.parent_id === 'string' && chain.has(meta.parent_id)
    }
    return (
      typeof meta?.generation_type === 'string' &&
      types.includes(meta.generation_type)
    )
  }) as unknown as Array<GenerationResultRow>
}

/** Soft-delete one result and take it off the canvas. */
export async function trashGenerationResult(id: string): Promise<void> {
  const { userId, supabase } = await resolveAuth()

  const { error } = await supabase
    .from('user_images')
    .update({ deleted_at: new Date().toISOString(), on_canvas: false })
    .eq('user_id', userId)
    .eq('id', id)

  if (error) throw new Error(error.message)
}

/** Index rows by their `generation_metadata.parent_id`, projecting each row. */
function childrenByParent<T>(
  rows: Array<ParentRow>,
  project: (row: ParentRow) => T,
): Map<string, Array<{ id: string; value: T }>> {
  const map = new Map<string, Array<{ id: string; value: T }>>()
  for (const row of rows) {
    const meta = row.generation_metadata as Record<string, unknown> | null
    if (typeof meta?.parent_id !== 'string') continue
    const siblings = map.get(meta.parent_id) ?? []
    siblings.push({ id: row.id, value: project(row) })
    map.set(meta.parent_id, siblings)
  }
  return map
}

/** BFS from the given roots over a parent index, ids and values, cycle-safe. */
function walk<T>(
  roots: Array<string>,
  childrenOf: Map<string, Array<{ id: string; value: T }>>,
): { chain: Array<string>; visited: Array<T> } {
  const chain = [...roots]
  const visited: Array<T> = []
  const seen = new Set(roots)
  const queue = [...roots]

  while (queue.length > 0) {
    const current = queue.shift()!
    for (const child of childrenOf.get(current) ?? []) {
      if (seen.has(child.id)) continue
      seen.add(child.id)
      chain.push(child.id)
      visited.push(child.value)
      queue.push(child.id)
    }
  }

  return { chain, visited }
}
