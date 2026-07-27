'use server'

import { resolveAuth } from '#/lib/server/auth.server'
import { sql } from '#/lib/server/db.server'

interface GroupImagesInput {
  primaryId: string
  childIds: Array<string>
}

export async function groupImages(data: GroupImagesInput) {
  const { userId } = await resolveAuth()

  if (data.childIds.length === 0) return

  // Merge `parent_id` into each child's metadata, leaving the rest of the
  // object alone. Previously a read of every child followed by one update per
  // child, each of which wrote back a whole object read moments earlier.
  const grouped = await sql`
    update user_images
    set generation_metadata =
      coalesce(generation_metadata, '{}'::jsonb)
        || jsonb_build_object('parent_id', ${data.primaryId}::text)
    where user_id = ${userId}
      and deleted_at is null
      and id in ${sql(data.childIds)}
    returning id
  `

  if (grouped.length === 0) return

  // Bump primary's sort_order so it floats to top
  await sql`
    update user_images
    set sort_order = ${Date.now() / 1000}
    where id = ${data.primaryId} and user_id = ${userId}
  `
}
