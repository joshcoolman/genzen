import { createServerFn } from '@tanstack/react-start'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/server/auth.server'

interface DeleteSequenceInput {
  accessToken: string
  sequenceId: string
}

export const deleteSequence = createServerFn({ method: 'POST' })
  .inputValidator((data: DeleteSequenceInput) => data)
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

    const { error } = await supabase
      .from('multishot_sequences')
      .delete()
      .eq('id', data.sequenceId)
      .eq('user_id', user.id)

    if (error) throw new Error(`Failed to delete sequence: ${error.message}`)
    return { success: true }
  })
