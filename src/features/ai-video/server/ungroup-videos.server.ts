import { createServerFn } from '@tanstack/react-start'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/server/auth.server'

interface UngroupByIds {
  accessToken: string
  videoIds: Array<string>
  parentId?: never
}

interface UngroupByParent {
  accessToken: string
  videoIds?: never
  parentId: string
}

type UngroupVideosInput = UngroupByIds | UngroupByParent

export const ungroupVideos = createServerFn({ method: 'POST' })
  .inputValidator((data: UngroupVideosInput) => data)
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

    let rows: Array<{ id: string; generation_metadata: unknown }>

    if (data.parentId) {
      const { data: allRows, error } = await supabase
        .from('user_images')
        .select('id, generation_metadata')
        .eq('user_id', user.id)
        .eq('source', 'ai_video')
        .is('deleted_at', null)

      if (error) throw new Error(error.message)

      rows = allRows.filter((row) => {
        const meta = row.generation_metadata as Record<string, unknown> | null
        return meta?.parent_id === data.parentId
      })
    } else if (data.videoIds && data.videoIds.length > 0) {
      const { data: fetchedRows, error } = await supabase
        .from('user_images')
        .select('id, generation_metadata')
        .eq('user_id', user.id)
        .eq('source', 'ai_video')
        .in('id', data.videoIds)

      if (error) throw new Error(error.message)
      rows = fetchedRows
    } else {
      return
    }

    if (rows.length === 0) return

    await Promise.all(
      rows.map(async (row) => {
        const existing = (row.generation_metadata ?? {}) as Record<
          string,
          unknown
        >
        const meta = { ...existing }
        delete meta.parent_id
        const { error } = await supabase
          .from('user_images')
          .update({ generation_metadata: meta })
          .eq('id', row.id)
          .eq('user_id', user.id)
        if (error) throw new Error(error.message)
      }),
    )
  })
