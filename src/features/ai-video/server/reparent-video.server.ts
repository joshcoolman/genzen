import { createServerFn } from '@tanstack/react-start'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/server/auth.server'

interface ReparentInput {
  accessToken: string
  videoId: string
  action: 'adopt' | 'detach'
  newParentId?: string
}

export const reparentVideo = createServerFn({ method: 'POST' })
  .inputValidator((data: ReparentInput) => data)
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

    const { data: row, error: fetchError } = await supabase
      .from('user_images')
      .select('id, generation_metadata')
      .eq('id', data.videoId)
      .eq('user_id', user.id)
      .eq('source', 'ai_video')
      .is('deleted_at', null)
      .single()

    if (fetchError) throw new Error(fetchError.message)

    const existing = (row.generation_metadata ?? {}) as Record<string, unknown>

    if (data.action === 'adopt') {
      if (!data.newParentId) throw new Error('newParentId required for adopt')

      const meta = { ...existing, parent_id: data.newParentId }
      const { error } = await supabase
        .from('user_images')
        .update({ generation_metadata: meta })
        .eq('id', data.videoId)
        .eq('user_id', user.id)
      if (error) throw new Error(error.message)

      await supabase
        .from('user_images')
        .update({ sort_order: Date.now() / 1000 })
        .eq('id', data.newParentId)
        .eq('user_id', user.id)
    } else {
      const meta = { ...existing }
      delete meta.parent_id
      const { error } = await supabase
        .from('user_images')
        .update({ generation_metadata: meta })
        .eq('id', data.videoId)
        .eq('user_id', user.id)
      if (error) throw new Error(error.message)
    }
  })
