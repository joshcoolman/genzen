import { createServerFn } from '@tanstack/react-start'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/server/auth.server'

interface CreateStyleInput {
  accessToken: string
  name: string
}

export const createStyle = createServerFn({ method: 'POST' })
  .inputValidator((data: CreateStyleInput) => data)
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

    const { data: style, error } = await supabase
      .from('style_collections')
      .insert({
        user_id: user.id,
        name: data.name,
      })
      .select()
      .single()

    if (error) throw new Error(`Create style failed: ${error.message}`)
    return { style }
  })
