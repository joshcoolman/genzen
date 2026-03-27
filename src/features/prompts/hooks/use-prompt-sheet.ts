import { useCallback, useState } from 'react'
import { listPrompts } from '../server/list-prompts.server'
import { savePrompt } from '../server/save-prompt.server'
import { deletePrompt } from '../server/delete-prompt.server'
import { restoreDefaults } from '../server/restore-defaults.server'
import { DEFAULT_PROMPTS } from '../defaults'
import type { UserPrompt } from '../types'
import { useAuth } from '@/lib/auth'

export function usePromptSheet() {
  const { session } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [prompts, setPrompts] = useState<Array<UserPrompt>>([])
  const [loading, setLoading] = useState(false)

  const accessToken = session?.access_token

  const fetchPrompts = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    try {
      const { prompts } = await listPrompts({ data: { accessToken } })
      setPrompts(prompts)
    } catch (err) {
      console.error('Failed to list prompts:', err)
    } finally {
      setLoading(false)
    }
  }, [accessToken])

  const open = useCallback(() => {
    setIsOpen(true)
    fetchPrompts()
  }, [fetchPrompts])

  const close = useCallback(() => {
    setIsOpen(false)
  }, [])

  const addPrompt = useCallback(
    async (title: string, content: string) => {
      if (!accessToken) return
      try {
        const { prompt } = await savePrompt({
          data: { accessToken, title, content },
        })
        setPrompts((prev) => [prompt, ...prev])
      } catch (err) {
        console.error('Failed to save prompt:', err)
      }
    },
    [accessToken],
  )

  const removePrompt = useCallback(
    async (id: string) => {
      if (!accessToken) return
      setPrompts((prev) => prev.filter((p) => p.id !== id))
      try {
        await deletePrompt({ data: { accessToken, id } })
      } catch (err) {
        console.error('Failed to delete prompt:', err)
        fetchPrompts()
      }
    },
    [accessToken, fetchPrompts],
  )

  const restore = useCallback(async () => {
    if (!accessToken) return
    try {
      await restoreDefaults({ data: { accessToken } })
      await fetchPrompts()
    } catch (err) {
      console.error('Failed to restore defaults:', err)
    }
  }, [accessToken, fetchPrompts])

  const hasAllDefaults = DEFAULT_PROMPTS.every((d) =>
    prompts.some((p) => p.default_key === d.key),
  )

  return {
    isOpen,
    open,
    close,
    prompts,
    loading,
    addPrompt,
    removePrompt,
    restore,
    hasAllDefaults,
  }
}
