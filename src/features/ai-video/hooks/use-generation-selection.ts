import { useCallback, useState } from 'react'
import { createWorkspace } from '@/features/ai-video/server/create-workspace.server'
import { getWorkspaces } from '@/features/ai-video/server/get-workspaces.server'
import { moveGenerations } from '@/features/ai-video/server/move-generations.server'

interface UseGenerationSelectionOptions {
  workspaceId: string
  accessToken: string | undefined
  onMoved: (ids: Set<string>) => void
}

export function useGenerationSelection({
  workspaceId,
  accessToken,
  onMoved,
}: UseGenerationSelectionOptions) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isMoving, setIsMoving] = useState(false)
  const [newWorkspaceName, setNewWorkspaceName] = useState('')
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [moveDialogOpen, setMoveDialogOpen] = useState(false)
  const [targetWorkspaceId, setTargetWorkspaceId] = useState<string | null>(
    null,
  )
  const [availableWorkspaces, setAvailableWorkspaces] = useState<
    Array<{
      id: string
      name: string
      generationCount: number
      preview: { heroUrl: string | null }
    }>
  >([])

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const openCreateDialog = useCallback(() => {
    setNewWorkspaceName('')
    setCreateDialogOpen(true)
  }, [])

  const openMoveDialog = useCallback(async () => {
    if (!accessToken) return
    try {
      const all = await getWorkspaces({
        data: { accessToken },
      })
      setAvailableWorkspaces(all.filter((ws) => ws.id !== workspaceId))
      setTargetWorkspaceId(null)
      setMoveDialogOpen(true)
    } catch (err) {
      console.error('Failed to load workspaces:', err)
    }
  }, [accessToken, workspaceId])

  const handleCreateAndMove = useCallback(async () => {
    if (!accessToken || !newWorkspaceName.trim() || selectedIds.size === 0)
      return
    setIsMoving(true)
    try {
      const newWs = await createWorkspace({
        data: { name: newWorkspaceName.trim(), accessToken },
      })
      await moveGenerations({
        data: {
          generationIds: [...selectedIds],
          targetWorkspaceId: newWs.id,
          accessToken,
        },
      })
      onMoved(selectedIds)
      setSelectedIds(new Set())
      setCreateDialogOpen(false)
      setNewWorkspaceName('')
    } catch (err) {
      console.error('Failed to create workspace:', err)
    } finally {
      setIsMoving(false)
    }
  }, [accessToken, newWorkspaceName, selectedIds, onMoved])

  const handleMoveToWorkspace = useCallback(async () => {
    if (!accessToken || !targetWorkspaceId || selectedIds.size === 0) return
    setIsMoving(true)
    try {
      await moveGenerations({
        data: {
          generationIds: [...selectedIds],
          targetWorkspaceId,
          accessToken,
        },
      })
      onMoved(selectedIds)
      setSelectedIds(new Set())
      setMoveDialogOpen(false)
      setTargetWorkspaceId(null)
    } catch (err) {
      console.error('Failed to move generations:', err)
    } finally {
      setIsMoving(false)
    }
  }, [accessToken, targetWorkspaceId, selectedIds, onMoved])

  return {
    selectedIds,
    isMoving,
    newWorkspaceName,
    setNewWorkspaceName,
    createDialogOpen,
    setCreateDialogOpen,
    moveDialogOpen,
    setMoveDialogOpen,
    targetWorkspaceId,
    setTargetWorkspaceId,
    availableWorkspaces,
    toggleSelect,
    clearSelection,
    openCreateDialog,
    openMoveDialog,
    handleCreateAndMove,
    handleMoveToWorkspace,
  }
}
