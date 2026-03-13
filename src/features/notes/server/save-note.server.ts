import { createServerFn } from '@tanstack/react-start'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/server/auth.server'

interface SaveNoteInput {
  accessToken: string
  title: string
  content: string
}

export const saveNote = createServerFn({ method: 'POST' })
  .inputValidator((data: SaveNoteInput) => data)
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

    const { data: note, error } = await supabase
      .from('notes')
      .insert({
        user_id: user.id,
        title: data.title,
        content: data.content,
      })
      .select()
      .single()

    if (error) throw new Error(`Save failed: ${error.message}`)
    return { note }
  })
