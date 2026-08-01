'use server'

import { resolveAuth } from '#/lib/server/auth.server'
import { sql } from '#/lib/server/db.server'

interface UpdateImageOrderInput {
  imageId: string
  sortOrder: number
}

export async function updateImageOrder(data: UpdateImageOrderInput) {
  const { userId } = await resolveAuth()

  await sql`
    update user_images
    set sort_order = ${data.sortOrder}
    where id = ${data.imageId} and user_id = ${userId}
  `
}
