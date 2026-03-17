import { createServerFn } from '@tanstack/react-start'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/server/auth.server'

const STALE_THRESHOLD_MINUTES = 3

interface ClearStaleInput {
  accessToken: string
}

export const clearStaleGenerations = createServerFn({ method: 'POST' })
  .inputValidator((data: ClearStaleInput) => data)
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

    const threshold = new Date(
      Date.now() - STALE_THRESHOLD_MINUTES * 60 * 1000,
    ).toISOString()

    const { data: cleared, error } = await supabase
      .from('user_images')
      .update({
        status: 'failed',
        generation_error: 'Generation timed out — cleared manually',
      })
      .eq('user_id', user.id)
      .in('status', ['pending', 'processing'])
      .lt('created_at', threshold)
      .select('id')

    if (error) {
      throw new Error(`Failed to clear stale generations: ${error.message}`)
    }

    return { cleared: cleared.length }
  })
