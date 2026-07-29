'use server'

import type { UserImageRow } from '#/lib/types/db'
import { resolveAuth } from '#/lib/server/auth.server'
import { first, sql } from '#/lib/server/db.server'

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

export interface EditSourceRef {
  id: string
  storage_path: string | null
  thumbnail_path: string | null
}

/** The rows an edit names as its source, for the chain's thumbnails. */
export async function listEditSourceRefs(
  ids: Array<string>,
): Promise<Array<EditSourceRef>> {
  if (ids.length === 0) return []

  const { userId } = await resolveAuth()

  return sql<Array<EditSourceRef>>`
    select id, storage_path, thumbnail_path
    from user_images
    where user_id = ${userId} and id in ${sql(ids)} and deleted_at is null
  `
}

export type GenerationResultRow = Pick<
  UserImageRow,
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
      // Everything generated from one of these images. This used to filter on
      // `parent_id`, the mutable grouping parent, which went with #204.
      return (
        typeof meta?.source_image_id === 'string' &&
        chain.has(meta.source_image_id)
      )
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
