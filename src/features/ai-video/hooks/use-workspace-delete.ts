import { useState } from 'react'
import { deleteWorkspace } from '@/features/ai-video/server/delete-workspace.server'

interface UseWorkspaceDeleteOptions {
  workspaceId: string
  accessToken: string | undefined
  navigate: (opts: { to: string }) => unknown
}

export interface WorkspaceDeleteState {
  deleteStep: number
  deleting: boolean
  deleteMessage: string | null
  startDelete: () => void
  handleConfirmStep1: () => void
  handleConfirmStep2: () => Promise<void>
  closeDelete: () => void
}

export function useWorkspaceDelete({
  workspaceId,
  accessToken,
  navigate,
}: UseWorkspaceDeleteOptions): WorkspaceDeleteState {
  const [deleteStep, setDeleteStep] = useState(0)
  const [deleting, setDeleting] = useState(false)
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null)

  function startDelete() {
    setDeleteStep(1)
  }

  function handleConfirmStep1() {
    setDeleteStep(2)
  }

  async function handleConfirmStep2() {
    if (!accessToken) return
    setDeleting(true)
    setDeleteMessage("Whatever, dude. It's your funeral.")
    try {
      await deleteWorkspace({ data: { workspaceId, accessToken } })
      await new Promise((r) => setTimeout(r, 1500))
      navigate({ to: '/dashboard/video' })
    } catch {
      setDeleting(false)
      setDeleteMessage(null)
      setDeleteStep(0)
    }
  }

  function closeDelete() {
    setDeleteStep(0)
    setDeleteMessage(null)
  }

  return {
    deleteStep,
    deleting,
    deleteMessage,
    startDelete,
    handleConfirmStep1,
    handleConfirmStep2,
    closeDelete,
  }
}
