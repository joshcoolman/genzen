'use server'

import type { UserImage } from '../types'
import { userImageColumns } from '#/lib/server/user-image-columns.server'
import { resolveAuth } from '#/lib/server/auth.server'
import { first, sql } from '#/lib/server/db.server'

// Server actions for the image queries the browser used to run directly against
// Supabase.
//
// The important change is not the transport, it is where `user_id` comes from.
// Every one of these previously took the id from the browser and trusted RLS to
// check it; here it comes from `resolveAuth()`, which reads the signed session
// cookie. A caller cannot ask for someone else's rows, because it never gets to
// name whose rows it wants.

export interface ListImagesFilters {
  search_term?: string
  limit?: number
  offset?: number
}

export async function listImages(
  filters?: ListImagesFilters,
): Promise<Array<UserImage>> {
  const { userId } = await resolveAuth()

  const pattern = filters?.search_term ? `%${filters.search_term}%` : null

  return sql<Array<UserImage>>`
    select ${userImageColumns()}
    from user_images
    where user_id = ${userId}
      and source in ('upload', 'ai_generated')
      and deleted_at is null
      ${
        pattern
          ? sql`and (title ilike ${pattern} or description ilike ${pattern})`
          : sql``
      }
    order by created_at desc
    ${
      filters?.limit !== undefined
        ? sql`limit ${filters.limit} offset ${filters.offset ?? 0}`
        : sql``
    }
  `
}

export interface CreateImageRecordInput {
  title: string
  description?: string | null
  storagePath: string
  fileName: string
  fileSize: number
  mimeType: string
  fileHash?: string
}

export async function createImageRecord(
  input: CreateImageRecordInput,
): Promise<UserImage> {
  const { userId } = await resolveAuth()

  // The path is built client-side but must still be inside this user's prefix,
  // or one user could write a row pointing at another's object.
  if (!input.storagePath.startsWith(`${userId}/`)) {
    throw new Error('Storage path must be scoped to the authenticated user')
  }

  // `origin` is written here rather than taken from the caller: this is the
  // only insert an upload can come through, and paste-on-canvas and
  // paste-on-Images produce identical bytes, so the surface authored nothing
  // (#207). `source` still relies on its column default, which cannot be wrong
  // for the same reason.
  const row = first(
    await sql<Array<UserImage>>`
    insert into user_images
      (user_id, title, description, storage_path, file_name, file_size,
       mime_type, file_hash, origin)
    values
      (${userId}, ${input.title}, ${input.description ?? null},
       ${input.storagePath}, ${input.fileName}, ${input.fileSize},
       ${input.mimeType}, ${input.fileHash ?? null}, 'upload')
    returning ${userImageColumns()}
  `,
  )

  if (!row) throw new Error('Insert returned no row')
  return row
}

export async function updateImageMeta(
  id: string,
  title: string,
  description: string | null,
): Promise<UserImage> {
  const { userId } = await resolveAuth()

  const row = first(
    await sql<Array<UserImage>>`
    update user_images
    set title = ${title}, description = ${description}
    where id = ${id} and user_id = ${userId}
    returning ${userImageColumns()}
  `,
  )

  if (!row) throw new Error('Image not found')
  return row
}

/**
 * Move an image to Trash. Deliberately does *not* touch canvas membership
 * (#212): trashing is a library operation, and evicting the image from a canvas
 * as a side effect destroyed an arrangement the user would have to rebuild by
 * hand. Membership survives, so restoring puts the card back where it was.
 *
 * Canvas reads filter `deleted_at is null`, so a trashed image stops rendering
 * on its own. Until the canvas's mount-time prune is gone, that prune still
 * strips the image locally and the next layout save drops the membership row --
 * so this write is correct but not yet sufficient on its own.
 */
export async function softDeleteImage(id: string): Promise<void> {
  const { userId } = await resolveAuth()

  // `group_id = null` here too, not just in the gallery's delete (#319):
  // restore has one destination whichever surface did the trashing, and three
  // paths that disagree is three different restores.
  await sql`
    update user_images set deleted_at = now(), group_id = null
    where id = ${id} and user_id = ${userId}
  `
}

export async function updateImageDescription(
  id: string,
  description: string,
): Promise<void> {
  const { userId } = await resolveAuth()

  await sql`
    update user_images set description = ${description}
    where id = ${id} and user_id = ${userId}
  `
}
