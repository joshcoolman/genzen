import { createServerFn } from '@tanstack/react-start'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/server/auth.server'
import { createApiKey } from '@/lib/server/api-keys.server'

interface CreateApiKeyInput {
  accessToken: string
  name: string
}

export const createApiKeyFn = createServerFn({ method: 'POST' })
  .inputValidator((data: CreateApiKeyInput) => {
    const trimmed = data.name.trim()
    if (!trimmed) throw new Error('Name is required')
    if (trimmed.length > 64) throw new Error('Name too long (max 64 chars)')
    return { accessToken: data.accessToken, name: trimmed }
  })
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

    const { rawKey, row } = await createApiKey({
      userId: user.id,
      name: data.name,
      client: supabase,
    })

    return { rawKey, key: row }
  })
