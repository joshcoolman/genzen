import 'server-only'
import { first, sql } from './db.server'
import { fetchAndUploadToFal } from './fal-image-upload.server'
import { createImageStorage } from '#/lib/image-storage'

/** Every image FAL is given is uploaded as **bytes**, never handed over as a URL
 *  for FAL to fetch. A public URL works in prod and can never work locally,
 *  where the object lives on `localhost:9010` -- FAL answers "Could not generate
 *  images with the given prompts and images", which reads as a model complaint
 *  rather than a plumbing failure. Generate learned this; retry had not (#214). */

/** Resolve a library row to a readable URL, scoped to its owner. */
export async function resolveLibraryImageUrl(
  imageId: string,
  userId: string,
): Promise<string | null> {
  const row = first(
    await sql<Array<{ storage_path: string | null }>>`
      select storage_path from user_images
      where id = ${imageId} and user_id = ${userId} and deleted_at is null
    `,
  )
  if (!row?.storage_path) return null
  return createImageStorage().getUrl(row.storage_path)
}

/** Upload a set of library images to FAL, preserving the caller's order.
 *
 *  Order matters: models read the list positionally, and the prompt labels them
 *  "[Image 1, Image 2, ...]". A `Promise.all` over the ids keeps that; resolving
 *  by whatever the database returned would not, because `in (...)` has no
 *  ordering guarantee. Rows that cannot be read are dropped rather than throwing
 *  -- one missing reference should not sink a generation that has others. */
export async function uploadLibraryImagesToFal(
  imageIds: Array<string>,
  userId: string,
): Promise<Array<string>> {
  if (imageIds.length === 0) return []

  const rows = await sql<Array<{ id: string; storage_path: string | null }>>`
    select id, storage_path from user_images
    where id in ${sql(imageIds)} and user_id = ${userId}
  `
  const pathById = new Map(rows.map((r) => [r.id, r.storage_path]))
  const storage = createImageStorage()

  const uploaded = await Promise.all(
    imageIds.map(async (id) => {
      const storagePath = pathById.get(id)
      if (!storagePath) return null
      const url = await storage.getUrl(storagePath)
      if (!url) return null
      try {
        return await fetchAndUploadToFal(url)
      } catch {
        return null
      }
    }),
  )
  return uploaded.filter((u): u is string => u !== null)
}
