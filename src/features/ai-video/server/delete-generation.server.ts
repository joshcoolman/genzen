import { createServerFn } from '@tanstack/react-start'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/server/auth.server'

interface DeleteGenerationInput {
  generationId: string
  accessToken: string
}

export const deleteGeneration = createServerFn({ method: 'POST' })
  .inputValidator((data: DeleteGenerationInput) => data)
  .handler(async ({ data }) => {
    const user = await requireAuth(data.accessToken)

    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.VITE_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: { Authorization: `Bearer ${data.accessToken}` },
        },
      },
    )

    // Fetch generation to get linked image IDs
    const { data: gen, error: fetchError } = await supabase
      .from('video_generations')
      .select('first_frame_id, last_frame_id, video_id')
      .eq('id', data.generationId)
      .eq('user_id', user.id)
      .single()

    if (fetchError) {
      throw new Error('Generation not found')
    }

    // Collect image record IDs and their storage paths
    const imageIds = [
      gen.first_frame_id,
      gen.last_frame_id,
      gen.video_id,
    ].filter(Boolean) as Array<string>

    if (imageIds.length > 0) {
      const { data: images } = await supabase
        .from('user_images')
        .select('id, storage_path')
        .in('id', imageIds)

      if (images && images.length > 0) {
        // Delete storage files
        const storagePaths = images
          .map((img) => img.storage_path)
          .filter(Boolean) as Array<string>
        if (storagePaths.length > 0) {
          await supabase.storage.from('user-images').remove(storagePaths)
        }

        // Delete user_images records
        await supabase
          .from('user_images')
          .delete()
          .in(
            'id',
            images.map((img) => img.id),
          )
      }
    }

    // Delete the generation record
    const { error: deleteError } = await supabase
      .from('video_generations')
      .delete()
      .eq('id', data.generationId)
      .eq('user_id', user.id)

    if (deleteError) {
      throw new Error(`Failed to delete generation: ${deleteError.message}`)
    }

    return { success: true }
  })
