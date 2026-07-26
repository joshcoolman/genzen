'use server'

import type { Json } from '@/lib/types/supabase'
import { resolveAuth } from '@/lib/server/auth.server'

interface ReparentInput {
  imageId: string
  action: 'adopt' | 'detach'
  newParentId?: string
}

export async function reparentImage(data: ReparentInput) {
  const { userId, supabase } = await resolveAuth()

  // Fetch current metadata for the target image
  const { data: row, error: fetchError } = await supabase
    .from('user_images')
    .select('id, generation_metadata')
    .eq('id', data.imageId)
    .eq('user_id', userId)
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
      .update({ generation_metadata: meta as Json })
      .eq('id', data.imageId)
      .eq('user_id', userId)
    if (error) throw new Error(error.message)

    // Bump parent's sort_order so it floats to top
    await supabase
      .from('user_images')
      .update({ sort_order: Date.now() / 1000 })
      .eq('id', data.newParentId)
      .eq('user_id', userId)
  } else {
    // Detach — remove parent_id only
    const meta = { ...existing }
    delete meta.parent_id
    const { error } = await supabase
      .from('user_images')
      .update({ generation_metadata: meta as Json })
      .eq('id', data.imageId)
      .eq('user_id', userId)
    if (error) throw new Error(error.message)
  }
}
