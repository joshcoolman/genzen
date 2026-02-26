import { useEffect, useRef, useState } from 'react'
import { getWorkspace } from '@/features/ai-video/server/get-workspace.server'
import { renameWorkspace } from '@/features/ai-video/server/rename-workspace.server'

export function useWorkspaceName(
  workspaceId: string,
  accessToken: string | undefined,
) {
  const [name, setName] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!accessToken) return
    getWorkspace({
      data: { workspaceId, accessToken },
    }).then((ws) => setName(ws.name))
  }, [workspaceId, accessToken])

  const startRename = () => {
    setEditValue(name)
    setIsEditing(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  const saveRename = async () => {
    setIsEditing(false)
    const trimmed = editValue.trim()
    if (!trimmed || trimmed === name || !accessToken) return
    setName(trimmed)
    try {
      await renameWorkspace({
        data: { workspaceId, name: trimmed, accessToken },
      })
    } catch (err) {
      console.error('Failed to rename workspace:', err)
    }
  }

  const cancelRename = () => {
    setIsEditing(false)
  }

  return {
    name,
    isEditing,
    editValue,
    setEditValue,
    inputRef,
    startRename,
    saveRename,
    cancelRename,
  }
}
