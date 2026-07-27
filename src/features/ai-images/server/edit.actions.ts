'use server'

import type { Tables } from '@/lib/types/supabase'
import { resolveAuth } from '@/lib/server/auth.server'
import { first, sql } from '@/lib/server/db.server'

// The edit page's reads, which the browser used to run directly against
// Supabase (#173). As elsewhere, `user_id` comes from `resolveAuth()`.
//
// The two tree walks moved with them. Both used to pull every one of the user's
// image rows into the browser to find a handful of descendants -- the BFS was
// client-side only because the data happened to be there. Server-side the
// browser asks for descendants and gets descendants, and since #172 the walk
// itself is a recursive CTE rather than a map-and-queue over a full table read.

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
  const { userId } = await resolveAuth()

  const data = first(
    await sql<
      Array<
        Omit<EditSourceImage, 'storage_path'> & { storage_path: string | null }
      >
    >`
    select id, title, storage_path, generation_metadata
    from user_images
    where user_id = ${userId} and id = ${imageId}
  `,
  )

  if (!data?.storage_path) return null

  return {
    id: data.id,
    title: data.title,
    storage_path: data.storage_path,
    generation_metadata: data.generation_metadata,
  }
}

/**
 * Every image whose `parent_id` chain reaches `rootId`, plus the root itself,
 * in BFS order. `parent_id` is the mutable organizational parent, not the
 * immutable generation source.
 */
export async function listDescendantIds(
  rootId: string,
): Promise<Array<string>> {
  const { userId } = await resolveAuth()

  const rows = await sql<Array<{ id: string }>>`
    ${descendantsCte([rootId], userId, sql`and c.source in ('upload', 'ai_generated')`)}
    select id from descendants order by depth
  `

  return rows.map((r) => r.id)
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

  const { userId } = await resolveAuth()

  // `depth > 0` drops each root itself -- a parent is not its own child.
  const rows = await sql<
    Array<{
      root: string
      id: string
      storage_path: string
      thumbnail_path: string | null
    }>
  >`
    ${descendantsCte(parentIds, userId, sql`and c.status = 'completed'`)}
    select root, id, storage_path, thumbnail_path
    from descendants
    where depth > 0 and storage_path is not null
    order by root, created_at desc
  `

  const result: Record<string, Array<EditChildRef>> = {}
  for (const row of rows) {
    ;(result[row.root] ??= []).push({
      id: row.id,
      storagePath: row.storage_path,
      thumbnailPath: row.thumbnail_path,
    })
  }

  return result
}

/**
 * The `parent_id` subtree under each of `rootIds`, tagged with the root it came
 * from so one query serves every parent the gallery is showing.
 *
 * Seeded from `unnest` rather than from `user_images`, because a caller may ask
 * about an id that has no row (or no longer matches the filter) and the JS walk
 * it replaces was happy to start from one.
 *
 * The `path` array is the visited-set that walk kept. It is load-bearing:
 * nothing stops a row naming itself as its own `parent_id`, and that is an
 * unbounded recursion rather than a wrong answer.
 */
function descendantsCte(
  rootIds: Array<string>,
  userId: string,
  childFilter: ReturnType<typeof sql>,
) {
  return sql`
    with recursive descendants as (
      select r.id, null::text as storage_path, null::text as thumbnail_path,
             null::timestamptz as created_at,
             r.id as root, 0 as depth, array[r.id] as path
      from unnest(${rootIds}::uuid[]) as r(id)
      union all
      select c.id, c.storage_path, c.thumbnail_path, c.created_at,
             d.root, d.depth + 1, d.path || c.id
      from user_images c
      join descendants d on c.generation_metadata->>'parent_id' = d.id::text
      where c.user_id = ${userId}
        and c.deleted_at is null
        ${childFilter}
        and not (c.id = any(d.path))
    )
  `
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

  const { userId } = await resolveAuth()

  const rows = await sql<Array<EditSourceRef>>`
    select id, storage_path, thumbnail_path, hidden
    from user_images
    where user_id = ${userId} and id in ${sql(ids)} and deleted_at is null
  `

  return rows.map((row) => ({
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
  const { userId } = await resolveAuth()

  // `file_size` is bigint, which the driver returns as a string; the cast keeps
  // `GenerationResultRow.file_size` a number. `created_at` is an ISO string on
  // that type, not a `Date`.
  const data = await sql<Array<GenerationResultRow>>`
    select id, storage_path, thumbnail_path, status, generation_metadata, title,
           file_size::float8 as file_size,
           to_json(created_at)#>>'{}' as created_at
    from user_images
    where user_id = ${userId}
      and source in ('upload', 'ai_generated')
      and deleted_at is null
    order by created_at desc
    limit ${limit}
  `

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
  const { userId } = await resolveAuth()

  await sql`
    update user_images set deleted_at = now(), on_canvas = false
    where user_id = ${userId} and id = ${id}
  `
}
