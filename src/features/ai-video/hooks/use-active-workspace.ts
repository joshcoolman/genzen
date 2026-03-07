import { useCallback, useEffect, useRef, useState } from 'react'
import type { Workspace } from '@/features/ai-video/hooks/use-workspaces'
import { getWorkspaces } from '@/features/ai-video/server/get-workspaces.server'
import { createWorkspace } from '@/features/ai-video/server/create-workspace.server'

interface UseActiveWorkspaceOptions {
  accessToken: string | undefined
  initialWorkspaceId?: string
}

export interface ActiveWorkspaceState {
  activeWorkspaceId: string | null
  workspaces: Array<Workspace>
  workspaceCount: number
  loading: boolean
  setActiveWorkspaceId: (id: string) => void
  refresh: () => Promise<void>
  // Create dialog state
  dialogOpen: boolean
  setDialogOpen: (open: boolean) => void
  newName: string
  setNewName: (name: string) => void
  creating: boolean
  handleCreate: () => Promise<void>
}

export function useActiveWorkspace({
  accessToken,
  initialWorkspaceId,
}: UseActiveWorkspaceOptions): ActiveWorkspaceState {
  const [workspaces, setWorkspaces] = useState<Array<Workspace>>([])
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(
    null,
  )
  const [loading, setLoading] = useState(true)
  const autoCreatedRef = useRef(false)

  // Create dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)

  const fetchWorkspaces = useCallback(async () => {
    if (!accessToken) return
    try {
      const result = await getWorkspaces({ data: { accessToken } })
      setWorkspaces(result)
      return result
    } catch {
      return []
    }
  }, [accessToken])

  const refresh = useCallback(async () => {
    const result = await fetchWorkspaces()
    if (!result || result.length === 0) return
    // If active workspace was deleted, pick first available
    const activeStillExists = result.some((w) => w.id === activeWorkspaceId)
    if (!activeStillExists) {
      setActiveWorkspaceId(result[0].id)
    }
  }, [fetchWorkspaces, activeWorkspaceId])

  useEffect(() => {
    if (!accessToken) return

    async function init() {
      setLoading(true)
      try {
        const result = await getWorkspaces({
          data: { accessToken: accessToken as string },
        })
        setWorkspaces(result)

        if (result.length === 0 && !autoCreatedRef.current) {
          // Auto-create a default workspace
          autoCreatedRef.current = true
          const ws = await createWorkspace({
            data: { name: 'Drafts', accessToken: accessToken! },
          })
          setWorkspaces([
            {
              id: ws.id,
              name: ws.name,
              createdAt: new Date().toISOString(),
              generationCount: 0,
              preview: {
                heroUrl: null,
                lastFrameUrl: null,
                thumbnailUrls: [],
                prompt: null,
              },
            },
          ])
          setActiveWorkspaceId(ws.id)
        } else if (result.length > 0) {
          // Use initialWorkspaceId if valid, otherwise first
          const match = initialWorkspaceId
            ? result.find((w) => w.id === initialWorkspaceId)
            : null
          setActiveWorkspaceId(match ? match.id : result[0].id)
        }
      } catch {
        // noop
      } finally {
        setLoading(false)
      }
    }

    init()
  }, [accessToken])

  async function handleCreate() {
    if (!accessToken || !newName.trim()) return
    setCreating(true)
    try {
      const ws = await createWorkspace({
        data: { name: newName.trim(), accessToken },
      })
      setDialogOpen(false)
      setNewName('')
      // Refresh and switch to new workspace
      const result = await getWorkspaces({ data: { accessToken } })
      setWorkspaces(result)
      setActiveWorkspaceId(ws.id)
    } catch {
      // keep dialog open
    } finally {
      setCreating(false)
    }
  }

  return {
    activeWorkspaceId,
    workspaces,
    workspaceCount: workspaces.length,
    loading,
    setActiveWorkspaceId,
    refresh,
    dialogOpen,
    setDialogOpen,
    newName,
    setNewName,
    creating,
    handleCreate,
  }
}
