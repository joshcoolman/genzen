'use server'

import { resolveAuth } from '@/lib/server/auth.server'
import { sql } from '@/lib/server/db.server'
import { generateAndStoreThumbnail } from '@/lib/server/generate-thumbnail.server'

interface CreateThumbnailInput {
  imageId: string
  storagePath: string
}

export async function createThumbnail(data: CreateThumbnailInput) {
  const { userId } = await resolveAuth()

  const thumbnailPath = await generateAndStoreThumbnail(
    userId,
    data.storagePath,
  )

  if (thumbnailPath) {
    await sql`
      update user_images
      set thumbnail_path = ${thumbnailPath}
      where id = ${data.imageId} and user_id = ${userId}
    `
  }

  return { thumbnailPath }
}
