import { createServerFn } from '@tanstack/react-start'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/server/auth.server'

interface SetGenerationParentInput {
  imageIds: Array<string>
  parentId: string
  accessToken: string
}

export const setGenerationParent = createServerFn({ method: 'POST' })
  .inputValidator((data: SetGenerationParentInput) => data)
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

    // Fetch current metadata for each image to merge cleanly
    const { data: rows, error: fetchError } = await supabase
      .from('user_images')
      .select('id, generation_metadata')
      .in('id', data.imageIds)
      .eq('user_id', user.id)

    if (fetchError) throw new Error(fetchError.message)

    type Row = {
      id: string
      generation_metadata: Record<string, unknown> | null
    }
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    const safeRows = (rows ?? []) as Array<Row>

    await Promise.all(
      safeRows.map(async (row) => {
        const existing = row.generation_metadata ?? {}
        const existingType = existing.generation_type as string | undefined
        const needsType =
          existingType !== 'edit' && existingType !== 'variation'
        const meta = {
          ...existing,
          source_image_id: data.parentId,
          ...(needsType ? { generation_type: 'variation' } : {}),
        }
        const { error } = await supabase
          .from('user_images')
          .update({ generation_metadata: meta })
          .eq('id', row.id)
          .eq('user_id', user.id)
        if (error) throw new Error(error.message)
      }),
    )
  })
