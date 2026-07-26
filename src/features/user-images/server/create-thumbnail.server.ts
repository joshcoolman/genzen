'use server'

import type { Database } from '@/lib/types/supabase'
import { resolveAuth } from '@/lib/server/auth.server'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin.server'
import { generateAndStoreThumbnail } from '@/lib/server/generate-thumbnail.server'

interface CreateThumbnailInput {
  imageId: string
  storagePath: string
}

export async function createThumbnail(data: CreateThumbnailInput) {
  const { userId } = await resolveAuth()
  const supabase = getSupabaseAdmin()

  const thumbnailPath = await generateAndStoreThumbnail(
    userId,
    data.storagePath,
  )

  if (thumbnailPath) {
    await supabase
      .from('user_images')
      .update({
        thumbnail_path: thumbnailPath,
      } satisfies Database['public']['Tables']['user_images']['Update'])
      .eq('id', data.imageId)
      .eq('user_id', userId)
  }

  return { thumbnailPath }
}
