import { createServerFn } from '@tanstack/react-start'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/server/auth.server'

interface GetWorkspaceInput {
  workspaceId: string
  accessToken: string
}

export const getWorkspace = createServerFn({ method: 'POST' })
  .inputValidator((data: GetWorkspaceInput) => data)
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

    const { data: workspace, error } = await supabase
      .from('video_workspaces')
      .select('id, name')
      .eq('id', data.workspaceId)
      .eq('user_id', user.id)
      .single()

    if (error) {
      throw new Error(`Failed to fetch workspace: ${error.message}`)
    }

    return { id: workspace.id, name: workspace.name }
  })
