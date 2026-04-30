import { createServerFn } from '@tanstack/react-start'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/server/auth.server'
import { revokeApiKey } from '@/lib/server/api-keys.server'

interface RevokeApiKeyInput {
  accessToken: string
  id: string
}

export const revokeApiKeyFn = createServerFn({ method: 'POST' })
  .inputValidator((data: RevokeApiKeyInput) => data)
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

    await revokeApiKey({ userId: user.id, id: data.id, client: supabase })
    return { success: true }
  })
