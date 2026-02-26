import { createServerFn } from '@tanstack/react-start'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/server/auth.server'

interface RenameWorkspaceInput {
  workspaceId: string
  name: string
  accessToken: string
}

export const renameWorkspace = createServerFn({ method: 'POST' })
  .inputValidator((data: RenameWorkspaceInput) => data)
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

    const { error } = await supabase
      .from('video_workspaces')
      .update({ name: data.name.trim() })
      .eq('id', data.workspaceId)
      .eq('user_id', user.id)

    if (error) {
      throw new Error(`Failed to rename workspace: ${error.message}`)
    }

    return { success: true }
  })
