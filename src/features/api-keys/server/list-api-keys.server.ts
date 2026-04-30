import { createServerFn } from '@tanstack/react-start'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/server/auth.server'
import { listApiKeys } from '@/lib/server/api-keys.server'

interface ListApiKeysInput {
  accessToken: string
}

export const listApiKeysFn = createServerFn({ method: 'GET' })
  .inputValidator((data: ListApiKeysInput) => data)
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

    const keys = await listApiKeys({ userId: user.id, client: supabase })
    return { keys }
  })
