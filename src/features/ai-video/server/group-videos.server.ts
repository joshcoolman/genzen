import { createServerFn } from '@tanstack/react-start'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/server/auth.server'

interface GroupVideosInput {
  accessToken: string
  primaryId: string
  childIds: Array<string>
}

export const groupVideos = createServerFn({ method: 'POST' })
  .inputValidator((data: GroupVideosInput) => data)
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

    if (data.childIds.length === 0) return

    const { data: rows, error: fetchError } = await supabase
      .from('user_images')
      .select('id, generation_metadata')
      .eq('user_id', user.id)
      .eq('source', 'ai_video')
      .is('deleted_at', null)
      .in('id', data.childIds)

    if (fetchError) throw new Error(fetchError.message)
    if (rows.length === 0) return

    await Promise.all(
      rows.map(async (row) => {
        const existing = (row.generation_metadata ?? {}) as Record<
          string,
          unknown
        >
        const meta = { ...existing, parent_id: data.primaryId }
        const { error } = await supabase
          .from('user_images')
          .update({ generation_metadata: meta })
          .eq('id', row.id)
          .eq('user_id', user.id)
        if (error) throw new Error(error.message)
      }),
    )

    // Bump primary's sort_order so it floats to top
    await supabase
      .from('user_images')
      .update({ sort_order: Date.now() / 1000 })
      .eq('id', data.primaryId)
      .eq('user_id', user.id)
  })
