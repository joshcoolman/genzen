import { createServerFn } from '@tanstack/react-start'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/server/auth.server'

interface UpdateGenerationInput {
  generationId: string
  videoId: string
  accessToken: string
}

export const updateGeneration = createServerFn({ method: 'POST' })
  .inputValidator((data: UpdateGenerationInput) => data)
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

    const { error } = await supabase
      .from('video_generations')
      .update({ video_id: data.videoId })
      .eq('id', data.generationId)
      .eq('user_id', user.id)

    if (error) {
      throw new Error(`Failed to update generation: ${error.message}`)
    }

    return { id: data.generationId }
  })
