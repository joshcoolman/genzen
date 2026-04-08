import { createServerFn } from '@tanstack/react-start'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/server/auth.server'

interface ListHistoryInput {
  accessToken: string
  search?: string
  page: number
  pageSize: number
}

export const listHistory = createServerFn({ method: 'GET' })
  .inputValidator((data: ListHistoryInput) => data)
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

    const offset = data.page * data.pageSize

    let query = supabase
      .from('user_images')
      .select('id, storage_path, generation_metadata, created_at', {
        count: 'exact',
      })
      .eq('user_id', user.id)
      .eq('source', 'ai_generated')
      .eq('status', 'completed')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + data.pageSize - 1)

    if (data.search) {
      query = query.ilike('generation_metadata->>prompt', `%${data.search}%`)
    }

    const { data: rows, count, error } = await query

    if (error) throw new Error(`Failed to list history: ${error.message}`)

    return { entries: rows, total: count ?? 0 }
  })
