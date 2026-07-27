'use server'

import { resolveAuth } from '#/lib/server/auth.server'
import { sql } from '#/lib/server/db.server'

interface UngroupByIds {
  imageIds: Array<string>
  parentId?: never
}

interface UngroupByParent {
  imageIds?: never
  parentId: string
}

type UngroupImagesInput = UngroupByIds | UngroupByParent

export async function ungroupImages(data: UngroupImagesInput) {
  const { userId } = await resolveAuth()

  // One statement either way. Finding a parent's children used to mean reading
  // every one of the user's rows and filtering in JS, and dropping the key
  // meant a read-modify-write per row -- N+1 round trips that could each lose a
  // concurrent edit to the rest of the object. `- 'parent_id'` removes the one
  // key and leaves the rest of the metadata alone.
  if (data.parentId) {
    await sql`
      update user_images
      set generation_metadata = generation_metadata - 'parent_id'
      where user_id = ${userId}
        and deleted_at is null
        and generation_metadata->>'parent_id' = ${data.parentId}
    `
    return
  }

  if (!data.imageIds?.length) return

  await sql`
    update user_images
    set generation_metadata = generation_metadata - 'parent_id'
    where user_id = ${userId} and id in ${sql(data.imageIds)}
  `
}
