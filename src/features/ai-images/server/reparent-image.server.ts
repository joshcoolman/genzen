'use server'

import { resolveAuth } from '@/lib/server/auth.server'
import { sql } from '@/lib/server/db.server'

interface ReparentInput {
  imageId: string
  action: 'adopt' | 'detach'
  newParentId?: string
}

export async function reparentImage(data: ReparentInput) {
  const { userId } = await resolveAuth()

  if (data.action === 'detach') {
    // `- 'parent_id'` edits the one key in place. This used to be read the
    // whole object, delete the key in JS, write it back -- which drops any key
    // a concurrent write added in between.
    await sql`
      update user_images
      set generation_metadata = generation_metadata - 'parent_id'
      where id = ${data.imageId} and user_id = ${userId} and deleted_at is null
    `
    return
  }

  if (!data.newParentId) throw new Error('newParentId required for adopt')

  // Set parent_id only — grouping is purely organizational
  const updated = await sql`
    update user_images
    set generation_metadata =
      coalesce(generation_metadata, '{}'::jsonb)
        || jsonb_build_object('parent_id', ${data.newParentId}::text)
    where id = ${data.imageId} and user_id = ${userId} and deleted_at is null
    returning id
  `

  if (updated.length === 0) throw new Error('Image not found')

  // Bump parent's sort_order so it floats to top
  await sql`
    update user_images
    set sort_order = ${Date.now() / 1000}
    where id = ${data.newParentId} and user_id = ${userId}
  `
}
