import { createServerFn } from '@tanstack/react-start'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/server/auth.server'

interface CreateWorkspaceInput {
  name: string
  accessToken: string
}

export const createWorkspace = createServerFn({ method: 'POST' })
  .inputValidator((data: CreateWorkspaceInput) => data)
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
      .insert({ user_id: user.id, name: data.name.trim() })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create workspace: ${error.message}`)
    }

    return { id: workspace.id, name: workspace.name }
  })
