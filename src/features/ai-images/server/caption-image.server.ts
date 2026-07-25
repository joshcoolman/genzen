import { createServerFn } from '@tanstack/react-start'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/server/auth.server'
import { describeImage } from '@/lib/server/describe-image.server'
import { createImageStorage } from '@/lib/image-storage'

interface CaptionImageInput {
  imageBase64?: string
  imageId?: string
  accessToken: string
  mode?: 'anchor' | 'reconstruct'
}

export const captionImage = createServerFn({ method: 'POST' })
  .inputValidator((data: CaptionImageInput) => data)
  .handler(async ({ data }) => {
    const user = await requireAuth(data.accessToken)

    let image: string = data.imageBase64 ?? ''

    if (data.imageId) {
      if (!/^[0-9a-f-]{36}$/i.test(data.imageId)) {
        throw new Error('Invalid imageId')
      }
      const supabase = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.VITE_SUPABASE_ANON_KEY!,
        {
          global: { headers: { Authorization: `Bearer ${data.accessToken}` } },
        },
      )
      const { data: row } = await supabase
        .from('user_images')
        .select('storage_path')
        .eq('id', data.imageId)
        .eq('user_id', user.id)
        .single()
      if (!row?.storage_path) throw new Error('Image not found')
      const url = await createImageStorage().getUrl(row.storage_path)
      if (!url) throw new Error('Could not resolve a URL for that image')
      image = url
    }

    const result = await describeImage(image, data.mode ?? 'anchor')
    return { caption: result }
  })
