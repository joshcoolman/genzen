import { createServerFn } from '@tanstack/react-start'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/server/auth.server'

interface ReparentInput {
  accessToken: string
  imageId: string
  action: 'adopt' | 'detach'
  newParentId?: string
}

export const reparentImage = createServerFn({ method: 'POST' })
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

    // Fetch current metadata for the target image
    const { data: row, error: fetchError } = await supabase
      .from('user_images')
      .select('id, generation_metadata')
      .eq('id', data.imageId)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .single()

    if (fetchError) throw new Error(fetchError.message)

    const existing = (row.generation_metadata ?? {}) as Record<string, unknown>

    if (data.action === 'adopt') {
      if (!data.newParentId) throw new Error('newParentId required for adopt')

      // Set parent_id only — grouping is purely organizational
      const meta = { ...existing, parent_id: data.newParentId }
      const { error } = await supabase
        .from('user_images')
        .update({ generation_metadata: meta })
        .eq('id', data.imageId)
        .eq('user_id', user.id)
      if (error) throw new Error(error.message)

      // Bump parent's sort_order so it floats to top
      await supabase
        .from('user_images')
        .update({ sort_order: Date.now() / 1000 })
        .eq('id', data.newParentId)
        .eq('user_id', user.id)
    } else {
      // Detach — remove parent_id only
      const meta = { ...existing }
      delete meta.parent_id
      const { error } = await supabase
        .from('user_images')
        .update({ generation_metadata: meta })
        .eq('id', data.imageId)
        .eq('user_id', user.id)
      if (error) throw new Error(error.message)
    }
  })
