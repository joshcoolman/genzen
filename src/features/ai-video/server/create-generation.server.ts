import { createServerFn } from '@tanstack/react-start'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/server/auth.server'

interface CreateGenerationInput {
  workspaceId: string
  firstFrameId: string
  lastFrameId: string
  videoId: string
  accessToken: string
}

export const createGeneration = createServerFn({ method: 'POST' })
  .inputValidator((data: CreateGenerationInput) => data)
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

    const { data: generation, error } = await supabase
      .from('video_generations')
      .insert({
        workspace_id: data.workspaceId,
        user_id: user.id,
        first_frame_id: data.firstFrameId,
        last_frame_id: data.lastFrameId,
        video_id: data.videoId,
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create generation: ${error.message}`)
    }

    return { id: generation.id }
  })
