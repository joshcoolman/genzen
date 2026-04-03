import { createServerFn } from '@tanstack/react-start'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/server/auth.server'

interface UngroupByIds {
  accessToken: string
  imageIds: Array<string>
  parentId?: never
}

interface UngroupByParent {
  accessToken: string
  imageIds?: never
  parentId: string
}

type UngroupImagesInput = UngroupByIds | UngroupByParent

export const ungroupImages = createServerFn({ method: 'POST' })
  .inputValidator((data: UngroupImagesInput) => data)
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
      // Find all children of the given parent
      const { data: allRows, error } = await supabase
        .from('user_images')
        .select('id, generation_metadata')
        .eq('user_id', user.id)
        .is('deleted_at', null)

      if (error) throw new Error(error.message)

      rows = allRows.filter((row) => {
        const meta = row.generation_metadata as Record<string, unknown> | null
        return meta?.parent_id === data.parentId
      })
    } else if (data.imageIds && data.imageIds.length > 0) {
      // Use the provided image IDs directly
      const { data: fetchedRows, error } = await supabase
        .from('user_images')
        .select('id, generation_metadata')
        .eq('user_id', user.id)
        .in('id', data.imageIds)

      if (error) throw new Error(error.message)
      rows = fetchedRows
    } else {
      return
    }

    if (rows.length === 0) return

    // Remove parent_id from each image — merge, never replace
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
