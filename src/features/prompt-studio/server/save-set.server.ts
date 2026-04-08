import { createServerFn } from '@tanstack/react-start'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/server/auth.server'

interface SaveSetInput {
  accessToken: string
  name: string
  prompt: string
  systemPrompt: string
  negativePrompt: string
  selectedModelIds: Array<string>
}

export const saveSet = createServerFn({ method: 'POST' })
  .inputValidator((data: SaveSetInput) => data)
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

    const { data: set, error } = await supabase
      .from('prompt_studio_sets')
      .insert({
        user_id: user.id,
        name: data.name,
        prompt: data.prompt,
        system_prompt: data.systemPrompt,
        negative_prompt: data.negativePrompt,
        selected_model_ids: data.selectedModelIds,
      })
      .select()
      .single()

    if (error) throw new Error(`Save set failed: ${error.message}`)
    return { set }
  })
