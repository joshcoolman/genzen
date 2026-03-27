import { createServerFn } from '@tanstack/react-start'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/server/auth.server'

interface SavePromptInput {
  accessToken: string
  title: string
  content: string
}

export const savePrompt = createServerFn({ method: 'POST' })
  .inputValidator((data: SavePromptInput) => data)
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

    const { data: prompt, error } = await supabase
      .from('user_prompts')
      .insert({
        user_id: user.id,
        title: data.title,
        content: data.content,
        is_default: false,
      })
      .select()
      .single()

    if (error) throw new Error(`Save failed: ${error.message}`)
    return { prompt }
  })
