'use server'

import type { SavedAiImage } from '#/features/ai-images/types'
import type { UserImageRow } from '#/lib/types/db'
import { resolveAuth } from '#/lib/server/auth.server'
import { first, sql } from '#/lib/server/db.server'
import { removeImages } from '#/features/user-images/server/remove-images.server'
import { ungroupImages } from '#/features/ai-images/server/ungroup-images.server'

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
    Pick<UserImageRow, 'id' | 'storage_path' | 'thumbnail_path'> & {
      hidden: boolean
    }
  >
}

export async function listGalleryImages(): Promise<GalleryPayload> {
  const { userId } = await resolveAuth()

  // `created_at` goes through `to_json(...)#>>'{}'` rather than being selected
  // raw: `SavedAiImage.created_at` is an ISO string, and the driver would
  // otherwise hand back a `Date`.
  const rows = await sql`
    select id, title, description, storage_path, thumbnail_path,
           to_json(created_at)#>>'{}' as created_at,
           sort_order, status, generation_error, generation_metadata
    from user_images
    where user_id = ${userId}
      and source in ('upload', 'ai_generated')
      and deleted_at is null
    order by sort_order desc nulls last
  `

  const images = rows as unknown as Array<SavedAiImage>

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

  const rootRows = await sql<
    Array<{
      id: string
      storage_path: string | null
      thumbnail_path: string | null
      hidden: boolean
    }>
  >`
    select id, storage_path, thumbnail_path, hidden
    from user_images
    where user_id = ${userId}
      and id in ${sql(Array.from(rootIds))}
      and deleted_at is null
  `

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
  const { userId } = await resolveAuth()

  const image = first(
    await sql<
      Array<{
        id: string
        status: string
        storage_path: string | null
        thumbnail_path: string | null
        generation_metadata: Record<string, unknown> | null
      }>
    >`
    select id, status, storage_path, thumbnail_path, generation_metadata
    from user_images
    where id = ${imageId} and user_id = ${userId}
  `,
  )

  if (!image) return

  // A failed generation produced no image, so Trash has nothing to offer for
  // it -- restoring one just puts an error card back. Deleting it is the user
  // saying "get rid of this", and it goes for good.
  if (image.status === 'failed') {
    await sql`
      delete from user_images where id = ${imageId} and user_id = ${userId}
    `

    // Defensive: a failed row normally has no objects, but a failure late in
    // the pipeline can leave one behind.
    const paths = [image.storage_path, image.thumbnail_path].filter(
      (p): p is string => !!p,
    )
    if (paths.length > 0) await removeImages({ storagePaths: paths })
    return
  }

  const [{ count: variationCount }] = await sql<Array<{ count: number }>>`
    select count(*)::int as count
    from user_images
    where user_id = ${userId}
      and (generation_metadata->>'root_image_id' = ${imageId}
           or generation_metadata->>'source_image_id' = ${imageId})
      and deleted_at is null
      and hidden = false
  `

  // Hidden keeps the row alive as a thumbnail source for its variations;
  // soft-delete is the ordinary path.
  if (variationCount > 0) {
    await sql`
      update user_images set hidden = true
      where id = ${imageId} and user_id = ${userId}
    `
  } else {
    await sql`
      update user_images set deleted_at = now(), on_canvas = false
      where id = ${imageId} and user_id = ${userId}
    `
  }

  const meta = image.generation_metadata
  if (meta?.generation_type !== 'variation') return
  const rootId = (meta.root_image_id ?? meta.source_image_id) as
    | string
    | undefined
  if (rootId) await cleanupHiddenRoot(rootId, imageId, userId)
}

async function cleanupHiddenRoot(
  rootId: string,
  excludeId: string,
  userId: string,
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
      and id <> ${excludeId}
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
  const { userId } = await resolveAuth()

  const rows = await sql<Array<{ id: string }>>`
    ${subtreeCte(imageId, userId)}
    select id from subtree
  `
  const idsToDelete = rows.map((r) => r.id)

  const childIds = idsToDelete.filter((id) => id !== imageId)
  if (childIds.length > 0) await ungroupImages({ imageIds: childIds })

  await sql`
    update user_images set deleted_at = now(), on_canvas = false
    where user_id = ${userId} and id in ${sql(idsToDelete)}
  `

  return idsToDelete
}

/**
 * The grouping subtree rooted at `rootId`, breadth-first.
 *
 * This used to be "select every one of the user's rows, build a parent->children
 * map in JS, then BFS it" -- the whole library pulled across the wire to find a
 * handful of descendants.
 *
 * The `path` array is the visited-set the JS walk kept, and it is not optional:
 * nothing stops a row from naming itself as its own `parent_id`, and a plain
 * `union` would not dedupe it away because each pass carries a new `depth`.
 * That is an unbounded recursion, not a wrong answer.
 *
 * The edge is `generation_metadata->>'parent_id'` (grouping), not
 * `source_image_id` (genealogy) -- the genealogy fields survive a delete so the
 * rows stay independently restorable from trash.
 */
function subtreeCte(rootId: string, userId: string) {
  return sql`
    with recursive subtree as (
      select id, storage_path, 0 as depth, array[id] as path
      from user_images
      where id = ${rootId} and user_id = ${userId} and deleted_at is null
      union all
      select c.id, c.storage_path, s.depth + 1, s.path || c.id
      from user_images c
      join subtree s on c.generation_metadata->>'parent_id' = s.id::text
      where c.user_id = ${userId}
        and c.deleted_at is null
        and not (c.id = any(s.path))
    )
  `
}

/**
 * Storage paths of everything grouped beneath `imageId`, in breadth-first
 * order -- the download-as-zip path, which needs the whole subtree's objects
 * and not just what the gallery happens to be holding.
 */
export async function listSubtreeStoragePaths(
  imageId: string,
): Promise<Array<string>> {
  const { userId } = await resolveAuth()

  // `depth > 0` drops the root itself, which the caller already holds; the
  // ordering is what makes this breadth-first, as the JS queue was.
  const rows = await sql<Array<{ storage_path: string }>>`
    ${subtreeCte(imageId, userId)}
    select storage_path from subtree
    where depth > 0 and storage_path is not null
    order by depth
  `

  return rows.map((r) => r.storage_path)
}

/** Delete an image but leave its group members in the gallery, unparented. */
export async function deleteGalleryImageDetachingChildren(
  imageId: string,
): Promise<void> {
  const { userId } = await resolveAuth()

  await ungroupImages({ parentId: imageId })

  await sql`
    update user_images set deleted_at = now(), on_canvas = false
    where id = ${imageId} and user_id = ${userId}
  `
}

/** Un-hide a root that was hidden to keep its variations' origin thumbnail. */
export async function restoreHiddenRootImage(rootId: string): Promise<void> {
  const { userId } = await resolveAuth()

  await sql`
    update user_images set hidden = false
    where id = ${rootId} and user_id = ${userId}
  `
}
