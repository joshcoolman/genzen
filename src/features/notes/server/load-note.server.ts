import { createServerFn } from '@tanstack/react-start'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/server/auth.server'

interface LoadNoteInput {
  accessToken: string
  id: string
}

export const loadNote = createServerFn({ method: 'GET' })
  .inputValidator((data: LoadNoteInput) => data)
  .handler(async ({ data }) => {
    await requireAuth(data.accessToken)

    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.VITE_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: { Authorization: `Bearer ${data.accessToken}` },
        },
      },
    )

    const { data: note, error } = await supabase
      .from('notes')
      .select('*')
      .eq('id', data.id)
      .single()

    if (error) throw new Error(`Load failed: ${error.message}`)
    return { note }
  })
