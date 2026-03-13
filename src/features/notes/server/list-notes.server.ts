import { createServerFn } from '@tanstack/react-start'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/server/auth.server'

interface ListNotesInput {
  accessToken: string
}

export const listNotes = createServerFn({ method: 'GET' })
  .inputValidator((data: ListNotesInput) => data)
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

    const { data: notes, error } = await supabase
      .from('notes')
      .select('id, title, created_at, updated_at')
      .order('created_at', { ascending: false })

    if (error) throw new Error(`List failed: ${error.message}`)
    return { notes }
  })
