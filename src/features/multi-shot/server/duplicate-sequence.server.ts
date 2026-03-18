import { createServerFn } from '@tanstack/react-start'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/server/auth.server'

interface DuplicateSequenceInput {
  accessToken: string
  sequenceId: string
}

export const duplicateSequence = createServerFn({ method: 'POST' })
  .inputValidator((data: DuplicateSequenceInput) => data)
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

    const { data: source, error: fetchError } = await supabase
      .from('multishot_sequences')
      .select('name, shots, elements, settings')
      .eq('id', data.sequenceId)
      .eq('user_id', user.id)
      .single()

    if (fetchError) throw new Error('Sequence not found')

    const { data: copy, error: insertError } = await supabase
      .from('multishot_sequences')
      .insert({
        user_id: user.id,
        name: `${source.name} (copy)`,
        shots: source.shots,
        elements: source.elements,
        settings: source.settings,
      })
      .select()
      .single()

    if (insertError)
      throw new Error(`Failed to duplicate: ${insertError.message}`)

    return { id: copy.id }
  })
