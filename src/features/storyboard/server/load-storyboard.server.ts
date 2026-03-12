import { createServerFn } from '@tanstack/react-start'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/server/auth.server'

interface LoadStoryboardInput {
  accessToken: string
  id?: string
}

export const loadStoryboard = createServerFn({ method: 'POST' })
  .inputValidator((data: LoadStoryboardInput) => data)
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

    if (data.id) {
      const { data: storyboard, error } = await supabase
        .from('storyboards')
        .select('*')
        .eq('id', data.id)
        .eq('user_id', user.id)
        .single()

      if (error) throw new Error(`Load failed: ${error.message}`)
      return { storyboard }
    }

    // Load most recent storyboard for this user
    const { data: storyboard } = await supabase
      .from('storyboards')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single()

    return { storyboard: storyboard ?? null }
  })
