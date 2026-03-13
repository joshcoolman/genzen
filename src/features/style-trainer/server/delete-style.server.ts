import { createServerFn } from '@tanstack/react-start'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/server/auth.server'

interface DeleteStyleInput {
  accessToken: string
  styleId: string
}

export const deleteStyle = createServerFn({ method: 'POST' })
  .inputValidator((data: DeleteStyleInput) => data)
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

    // Get all style images to clean up storage
    const { data: images } = await supabase
      .from('style_images')
      .select('storage_path')
      .eq('style_id', data.styleId)

    // Delete storage files
    if (images && images.length > 0) {
      const paths = images.map((img) => img.storage_path)
      await supabase.storage.from('styles').remove(paths)
    }

    // Delete the collection (cascade deletes style_images)
    const { error } = await supabase
      .from('style_collections')
      .delete()
      .eq('id', data.styleId)

    if (error) throw new Error(`Delete style failed: ${error.message}`)
    return { success: true }
  })
