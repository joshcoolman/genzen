import { createServerFn } from '@tanstack/react-start'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/server/auth.server'

interface DeleteNoteInput {
  accessToken: string
  id: string
}

export const deleteNote = createServerFn({ method: 'POST' })
  .inputValidator((data: DeleteNoteInput) => data)
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

    const { error } = await supabase.from('notes').delete().eq('id', data.id)

    if (error) throw new Error(`Delete failed: ${error.message}`)
    return { success: true }
  })
