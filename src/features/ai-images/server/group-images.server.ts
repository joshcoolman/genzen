'use server'

import { resolveAuth } from '@/lib/server/auth.server'

interface GroupImagesInput {
  primaryId: string
  childIds: Array<string>
}

export async function groupImages(data: GroupImagesInput) {
  const { userId, supabase } = await resolveAuth()

  if (data.childIds.length === 0) return

  // Fetch current metadata for all children
  const { data: rows, error: fetchError } = await supabase
    .from('user_images')
    .select('id, generation_metadata')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .in('id', data.childIds)

  if (fetchError) throw new Error(fetchError.message)
  if (rows.length === 0) return

  // Set parent_id on each child — merge into existing metadata
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
        .eq('user_id', userId)
      if (error) throw new Error(error.message)
    }),
  )

  // Bump primary's sort_order so it floats to top
  await supabase
    .from('user_images')
    .update({ sort_order: Date.now() / 1000 })
    .eq('id', data.primaryId)
    .eq('user_id', userId)
}
