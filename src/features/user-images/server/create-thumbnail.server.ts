import { createServerFn } from '@tanstack/react-start'
import type { Database } from '@/lib/types/supabase'
import { requireAuth } from '@/lib/server/auth.server'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin.server'
import { generateAndStoreThumbnail } from '@/lib/server/generate-thumbnail.server'

interface CreateThumbnailInput {
  accessToken: string
  imageId: string
  storagePath: string
}

export const createThumbnail = createServerFn({ method: 'POST' })
  .inputValidator((data: CreateThumbnailInput) => data)
  .handler(async ({ data }) => {
    const user = await requireAuth(data.accessToken)
    const supabase = getSupabaseAdmin()

    const thumbnailPath = await generateAndStoreThumbnail(
      user.id,
      data.storagePath,
    )

    if (thumbnailPath) {
      await supabase
        .from('user_images')
        .update({
          thumbnail_path: thumbnailPath,
        } satisfies Database['public']['Tables']['user_images']['Update'])
        .eq('id', data.imageId)
        .eq('user_id', user.id)
    }

    return { thumbnailPath }
  })
