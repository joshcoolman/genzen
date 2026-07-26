'use server'

import type { Json } from '@/lib/types/supabase'
import { resolveAuth } from '@/lib/server/auth.server'

interface UngroupByIds {
  imageIds: Array<string>
  parentId?: never
}

interface UngroupByParent {
  imageIds?: never
  parentId: string
}

type UngroupImagesInput = UngroupByIds | UngroupByParent

export async function ungroupImages(data: UngroupImagesInput) {
  const { userId, supabase } = await resolveAuth()

  let rows: Array<{ id: string; generation_metadata: unknown }>

  if (data.parentId) {
    // Find all children of the given parent
    const { data: allRows, error } = await supabase
      .from('user_images')
      .select('id, generation_metadata')
      .eq('user_id', userId)
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
      .eq('user_id', userId)
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
        .update({ generation_metadata: meta as Json })
        .eq('id', row.id)
        .eq('user_id', userId)
      if (error) throw new Error(error.message)
    }),
  )
}
