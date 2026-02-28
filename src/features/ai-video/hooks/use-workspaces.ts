import { useEffect, useState } from 'react'
import { getWorkspaces } from '@/features/ai-video/server/get-workspaces.server'
import { createWorkspace } from '@/features/ai-video/server/create-workspace.server'

export type Workspace = {
  id: string
  name: string
  createdAt: string
  generationCount: number
  preview: {
    heroUrl: string | null
    lastFrameUrl: string | null
    thumbnailUrls: Array<string>
    prompt: string | null
  }
}

interface UseWorkspacesOptions {
  accessToken: string | undefined
  navigate: (opts: {
    to: string
    params: { workspaceId: string }
    search: { generationId: undefined }
  }) => Promise<unknown>
}

export interface WorkspacesState {
  workspaces: Array<Workspace>
  loading: boolean
  dialogOpen: boolean
  setDialogOpen: (open: boolean) => void
  newName: string
  setNewName: (name: string) => void
  creating: boolean
  handleCreate: () => Promise<void>
  openDialog: () => void
  closeDialog: () => void
}

export function useWorkspaces({
  accessToken,
  navigate,
}: UseWorkspacesOptions): WorkspacesState {
  const [workspaces, setWorkspaces] = useState<Array<Workspace>>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (!accessToken) return
    getWorkspaces({ data: { accessToken } })
      .then(setWorkspaces)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [accessToken])

  async function handleCreate() {
    if (!accessToken || !newName.trim()) return
    setCreating(true)
    try {
      const workspace = await createWorkspace({
        data: { name: newName.trim(), accessToken },
      })
      setDialogOpen(false)
      setNewName('')
      await navigate({
        to: '/dashboard/video/$workspaceId',
        params: { workspaceId: workspace.id },
        search: { generationId: undefined },
      })
    } catch {
      // keep dialog open on error
    } finally {
      setCreating(false)
    }
  }

  function openDialog() {
    setDialogOpen(true)
  }

  function closeDialog() {
    setDialogOpen(false)
    setNewName('')
  }

  return {
    workspaces,
    loading,
    dialogOpen,
    setDialogOpen,
    newName,
    setNewName,
    creating,
    handleCreate,
    openDialog,
    closeDialog,
  }
}
