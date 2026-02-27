import { createServerFn } from '@tanstack/react-start'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/server/auth.server'

interface UpdateImageOrderInput {
  accessToken: string
  imageId: string
  sortOrder: number
}

export const updateImageOrder = createServerFn({ method: 'POST' })
  .inputValidator((data: UpdateImageOrderInput) => data)
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

    const { error } = await supabase
      .from('user_images')
      .update({ sort_order: data.sortOrder })
      .eq('id', data.imageId)
      .eq('user_id', user.id)

    if (error) throw new Error(error.message)
  })
