import { createServerFn } from '@tanstack/react-start'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/server/auth.server'

interface RemoveStyleImageInput {
  accessToken: string
  styleId: string
  imageId: string
}

export const removeStyleImage = createServerFn({ method: 'POST' })
  .inputValidator((data: RemoveStyleImageInput) => data)
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

    // Get image to clean up storage
    const { data: image, error: fetchError } = await supabase
      .from('style_images')
      .select('storage_path')
      .eq('id', data.imageId)
      .eq('style_id', data.styleId)
      .single()

    if (fetchError || !image)
      throw new Error('Image not found or access denied')

    // Delete from storage
    await supabase.storage.from('styles').remove([image.storage_path])

    // Delete record
    const { error } = await supabase
      .from('style_images')
      .delete()
      .eq('id', data.imageId)

    if (error) throw new Error(`Remove image failed: ${error.message}`)

    // Update image_count
    const { count } = await supabase
      .from('style_images')
      .select('id', { count: 'exact', head: true })
      .eq('style_id', data.styleId)

    // Update thumbnail if we removed the first image
    const { data: firstImage } = await supabase
      .from('style_images')
      .select('storage_path')
      .eq('style_id', data.styleId)
      .order('sort_order', { ascending: true })
      .limit(1)
      .maybeSingle()

    await supabase
      .from('style_collections')
      .update({
        image_count: count ?? 0,
        thumbnail_path: firstImage?.storage_path ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', data.styleId)

    return { success: true }
  })
