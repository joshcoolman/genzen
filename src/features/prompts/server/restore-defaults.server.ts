import { createServerFn } from '@tanstack/react-start'
import { createClient } from '@supabase/supabase-js'
import { DEFAULT_PROMPTS } from '../defaults'
import { requireAuth } from '@/lib/server/auth.server'

interface RestoreDefaultsInput {
  accessToken: string
}

export const restoreDefaults = createServerFn({ method: 'POST' })
  .inputValidator((data: RestoreDefaultsInput) => data)
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

    // Find which default keys already exist
    const { data: existing } = await supabase
      .from('user_prompts')
      .select('default_key')
      .not('default_key', 'is', null)

    const existingKeys = new Set(existing?.map((r) => r.default_key) ?? [])
    const missing = DEFAULT_PROMPTS.filter((d) => !existingKeys.has(d.key))

    if (missing.length === 0) return { restored: 0 }

    const rows = missing.map((d) => ({
      user_id: user.id,
      title: d.title,
      content: d.content,
      is_default: true,
      default_key: d.key,
    }))

    const { error } = await supabase.from('user_prompts').insert(rows)
    if (error) throw new Error(`Restore failed: ${error.message}`)

    return { restored: missing.length }
  })
