import { createServerFn } from '@tanstack/react-start'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/server/auth.server'

interface GetWorkspacesInput {
  accessToken: string
}

export const getWorkspaces = createServerFn({ method: 'POST' })
  .inputValidator((data: GetWorkspacesInput) => data)
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

    const { data: workspaces, error } = await supabase
      .from('video_workspaces')
      .select('id, name, created_at, video_generations(count)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch workspaces: ${error.message}`)
    }

    return workspaces.map((w) => ({
      id: w.id as string,
      name: w.name as string,
      createdAt: w.created_at as string,
      generationCount:
        (w.video_generations as unknown as Array<{ count: number }>)[0]
          ?.count ?? 0,
    }))
  })
