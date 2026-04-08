import { createServerFn } from '@tanstack/react-start'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/server/auth.server'

interface DeleteSetInput {
  accessToken: string
  id: string
}

export const deleteSet = createServerFn({ method: 'POST' })
  .inputValidator((data: DeleteSetInput) => data)
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
      .from('prompt_studio_sets')
      .delete()
      .eq('id', data.id)
      .eq('user_id', user.id)

    if (error) throw new Error(`Delete set failed: ${error.message}`)
    return { success: true }
  })
