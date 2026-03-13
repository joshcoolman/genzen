import { createServerFn } from '@tanstack/react-start'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/server/auth.server'

interface GetStylesInput {
  accessToken: string
}

export const getStyles = createServerFn({ method: 'GET' })
  .inputValidator((data: GetStylesInput) => data)
  .handler(async ({ data }) => {
    await requireAuth(data.accessToken)

    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.VITE_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: { Authorization: `Bearer ${data.accessToken}` },
        },
      },
    )

    const { data: styles, error } = await supabase
      .from('style_collections')
      .select('*, style_images(id, storage_path, sort_order)')
      .order('created_at', { ascending: false })

    if (error) throw new Error(`Get styles failed: ${error.message}`)

    // Generate signed URLs for thumbnails
    const stylesWithUrls = await Promise.all(
      styles.map(async (style) => {
        let thumbnailUrl: string | null = null
        if (style.thumbnail_path) {
          const { data: urlData } = await supabase.storage
            .from('styles')
            .createSignedUrl(style.thumbnail_path, 3600)
          thumbnailUrl = urlData?.signedUrl ?? null
        }
        return { ...style, thumbnailUrl }
      }),
    )

    return { styles: stylesWithUrls }
  })

interface GetStyleImagesInput {
  accessToken: string
  styleId: string
}

export const getStyleImages = createServerFn({ method: 'GET' })
  .inputValidator((data: GetStyleImagesInput) => data)
  .handler(async ({ data }) => {
    await requireAuth(data.accessToken)

    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.VITE_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: { Authorization: `Bearer ${data.accessToken}` },
        },
      },
    )

    const { data: images, error } = await supabase
      .from('style_images')
      .select('*')
      .eq('style_id', data.styleId)
      .order('sort_order', { ascending: true })

    if (error) throw new Error(`Get style images failed: ${error.message}`)

    // Generate signed URLs for each image
    const imagesWithUrls = await Promise.all(
      images.map(async (img) => {
        const { data: urlData } = await supabase.storage
          .from('styles')
          .createSignedUrl(img.storage_path, 3600)
        return { ...img, url: urlData?.signedUrl ?? null }
      }),
    )

    return { images: imagesWithUrls }
  })
