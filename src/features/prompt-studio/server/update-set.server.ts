import { createServerFn } from '@tanstack/react-start'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/server/auth.server'

interface UpdateSetInput {
  accessToken: string
  id: string
  name?: string
  prompt?: string
  systemPrompt?: string
  negativePrompt?: string
  selectedModelIds?: Array<string>
}

export const updateSet = createServerFn({ method: 'POST' })
  .inputValidator((data: UpdateSetInput) => data)
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

    const updates: Record<string, unknown> = {}
    if (data.name !== undefined) updates.name = data.name
    if (data.prompt !== undefined) updates.prompt = data.prompt
    if (data.systemPrompt !== undefined)
      updates.system_prompt = data.systemPrompt
    if (data.negativePrompt !== undefined)
      updates.negative_prompt = data.negativePrompt
    if (data.selectedModelIds !== undefined)
      updates.selected_model_ids = data.selectedModelIds

    const { data: set, error } = await supabase
      .from('prompt_studio_sets')
      .update(updates)
      .eq('id', data.id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) throw new Error(`Update set failed: ${error.message}`)
    return { set }
  })
