import { createServerFn } from '@tanstack/react-start'
import { createClient } from '@supabase/supabase-js'
import type { MultiShotElement, MultiShotSettings, Shot } from '../types'
import { requireAuth } from '@/lib/server/auth.server'

interface SaveSequenceInput {
  accessToken: string
  id?: string
  name: string
  shots: Array<Shot>
  elements: Array<MultiShotElement>
  settings: MultiShotSettings
}

export const saveSequence = createServerFn({ method: 'POST' })
  .inputValidator((data: SaveSequenceInput) => data)
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

    const row = {
      user_id: user.id,
      name: data.name.trim() || 'Untitled',
      shots: data.shots,
      elements: data.elements,
      settings: data.settings,
      updated_at: new Date().toISOString(),
    }

    if (data.id) {
      const { data: sequence, error } = await supabase
        .from('multishot_sequences')
        .update(row)
        .eq('id', data.id)
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) throw new Error(`Failed to update sequence: ${error.message}`)
      return { id: sequence.id }
    }

    const { data: sequence, error } = await supabase
      .from('multishot_sequences')
      .insert(row)
      .select()
      .single()

    if (error) throw new Error(`Failed to create sequence: ${error.message}`)
    return { id: sequence.id }
  })
