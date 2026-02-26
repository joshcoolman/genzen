import { createServerFn } from '@tanstack/react-start'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/server/auth.server'

interface MoveGenerationsInput {
  generationIds: Array<string>
  targetWorkspaceId: string
  accessToken: string
}

export const moveGenerations = createServerFn({ method: 'POST' })
  .inputValidator((data: MoveGenerationsInput) => data)
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
      .update({ workspace_id: data.targetWorkspaceId })
      .in('id', data.generationIds)
      .eq('user_id', user.id)

    if (error) {
      throw new Error(`Failed to move generations: ${error.message}`)
    }

    return { success: true }
  })
