import { createServerFn } from '@tanstack/react-start'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/server/auth.server'
import { createImageStorage } from '@/lib/image-storage'

interface DeleteWorkspaceInput {
  workspaceId: string
  accessToken: string
}

export const deleteWorkspace = createServerFn({ method: 'POST' })
  .inputValidator((data: DeleteWorkspaceInput) => data)
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

    // Fetch all generations in this workspace to collect image IDs
    const { data: generations, error: fetchError } = await supabase
      .from('video_generations')
      .select('id, first_frame_id, last_frame_id, video_id')
      .eq('workspace_id', data.workspaceId)
      .eq('user_id', user.id)

    if (fetchError) {
      throw new Error(`Failed to fetch generations: ${fetchError.message}`)
    }

    // Collect all image record IDs from this workspace's generations
    const generationIds = new Set(generations.map((g) => g.id))
    const imageIds = generations
      .flatMap((g) => [g.first_frame_id, g.last_frame_id, g.video_id])
      .filter(Boolean) as Array<string>

    if (imageIds.length > 0) {
      // Check which image records are shared by generations in OTHER workspaces
      const { data: otherGens } = await supabase
        .from('video_generations')
        .select('first_frame_id, last_frame_id, video_id')
        .eq('user_id', user.id)
        .not('id', 'in', `(${[...generationIds].join(',')})`)

      const sharedIds = new Set<string>()
      if (otherGens) {
        for (const g of otherGens) {
          if (g.first_frame_id) sharedIds.add(g.first_frame_id)
          if (g.last_frame_id) sharedIds.add(g.last_frame_id)
          if (g.video_id) sharedIds.add(g.video_id)
        }
      }

      // Only delete image records not referenced by other generations
      const uniqueIds = [...new Set(imageIds)]
      const safeToDeleteIds = uniqueIds.filter((id) => !sharedIds.has(id))

      if (safeToDeleteIds.length > 0) {
        const { data: images } = await supabase
          .from('user_images')
          .select('id, storage_path')
          .in('id', safeToDeleteIds)

        if (images && images.length > 0) {
          // Delete storage files
          const storagePaths = images
            .map((img) => img.storage_path)
            .filter(Boolean) as Array<string>
          if (storagePaths.length > 0) {
            await createImageStorage(supabase).remove(storagePaths)
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
    }

    // Delete the workspace (CASCADE handles video_generations)
    const { error: deleteError } = await supabase
      .from('video_workspaces')
      .delete()
      .eq('id', data.workspaceId)
      .eq('user_id', user.id)

    if (deleteError) {
      throw new Error(`Failed to delete workspace: ${deleteError.message}`)
    }

    return { success: true }
  })
