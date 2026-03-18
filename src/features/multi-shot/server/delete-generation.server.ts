import { createServerFn } from '@tanstack/react-start'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/server/auth.server'

interface DeleteGenerationInput {
  accessToken: string
  generationId: string
}

export const deleteGeneration = createServerFn({ method: 'POST' })
  .inputValidator((data: DeleteGenerationInput) => data)
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

    // Soft-delete the user_images record
    const { error } = await supabase
      .from('user_images')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', data.generationId)
      .eq('user_id', user.id)

    if (error) throw new Error(`Failed to delete generation: ${error.message}`)
    return { success: true }
  })
