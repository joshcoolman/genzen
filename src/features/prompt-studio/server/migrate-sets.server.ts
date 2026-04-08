import { createServerFn } from '@tanstack/react-start'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/server/auth.server'

interface MigrateSetsInput {
  accessToken: string
  sets: Array<{
    id: string
    name: string
    prompt: string
    systemPrompt: string
    negativePrompt: string
    selectedModelIds: Array<string>
    createdAt: string
    updatedAt: string
  }>
}

export const migrateSets = createServerFn({ method: 'POST' })
  .inputValidator((data: MigrateSetsInput) => data)
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

    const rows = data.sets.map((s) => ({
      id: s.id,
      user_id: user.id,
      name: s.name,
      prompt: s.prompt,
      system_prompt: s.systemPrompt,
      negative_prompt: s.negativePrompt,
      selected_model_ids: s.selectedModelIds,
      created_at: s.createdAt,
      updated_at: s.updatedAt,
    }))

    const { data: inserted, error } = await supabase
      .from('prompt_studio_sets')
      .upsert(rows, { onConflict: 'id', ignoreDuplicates: true })
      .select()

    if (error) throw new Error(`Migrate sets failed: ${error.message}`)
    return { count: inserted.length }
  })
