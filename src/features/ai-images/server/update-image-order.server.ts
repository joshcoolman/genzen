'use server'

import { resolveAuth } from '@/lib/server/auth.server'

interface UpdateImageOrderInput {
  imageId: string
  sortOrder: number
}

export async function updateImageOrder(data: UpdateImageOrderInput) {
  const { userId, supabase } = await resolveAuth()

  const { error } = await supabase
    .from('user_images')
    .update({ sort_order: data.sortOrder })
    .eq('id', data.imageId)
    .eq('user_id', userId)

  if (error) throw new Error(error.message)
}
