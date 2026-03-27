import { createServerFn } from '@tanstack/react-start'
import { createClient } from '@supabase/supabase-js'
import { DEFAULT_PROMPTS } from '../defaults'
import { requireAuth } from '@/lib/server/auth.server'

interface ListPromptsInput {
  accessToken: string
}

export const listPrompts = createServerFn({ method: 'GET' })
  .inputValidator((data: ListPromptsInput) => data)
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

    // Check if user has any prompts
    const { data: existing, error: countError } = await supabase
      .from('user_prompts')
      .select('id')
      .limit(1)

    if (countError) throw new Error(`List failed: ${countError.message}`)

    // Seed defaults on first access
    if (existing.length === 0) {
      const rows = DEFAULT_PROMPTS.map((d) => ({
        user_id: user.id,
        title: d.title,
        content: d.content,
        is_default: true,
        default_key: d.key,
      }))
      const { error: seedError } = await supabase
        .from('user_prompts')
        .insert(rows)
      if (seedError) throw new Error(`Seed failed: ${seedError.message}`)
    }

    const { data: prompts, error } = await supabase
      .from('user_prompts')
      .select('*')
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) throw new Error(`List failed: ${error.message}`)
    return { prompts }
  })
